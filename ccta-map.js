	qx.Class.define("ccta_map", 
	{
		type: "singleton",
		extend: qx.core.Object,
		
		construct: function()
		{
			try
			{				
				var mapButton = new qx.ui.form.Button('Map');
				var app = qx.core.Init.getApplication();
                		var optionsBar = app.getOptionsBar().getLayoutParent();
				var d = this.__getData();
				
				mapButton.addListener('execute', function()
				{
					this.data = d;
					ccta_map.container.getInstance().open();
				}, this);
				
				optionsBar.add(mapButton);

			}
			catch(e)
			{
				console.log(e.toString());
			}
			console.log('ccta_map initialization completed');
		},
		destruct: function(){},
		members: 
		{
			__getBases: function(pid)
			{
					var a = [];
					ClientLib.Net.CommunicationManager.GetInstance().SendSimpleCommand("GetPublicPlayerInfo", { id: pid }, 
					phe.cnc.Util.createEventDelegate(ClientLib.Net.CommandResult, this, function(context, data)
					{
						if (data.c != null){
							for (var i = 0; i < data.c.length; i++){
								var id = data.c[i].i;
								var name = data.c[i].n;
								var x = data.c[i].x
								var y = data.c[i].y;
								a.push([x, y, name, id]);
							}
						}
					}), null);
					return a;
			},
				
			__getPlayers: function(aid)
			{
					var a = {}, parent = this;
					ClientLib.Net.CommunicationManager.GetInstance().SendSimpleCommand("GetPublicAllianceInfo", { id: parseInt(aid) }, 
					phe.cnc.Util.createEventDelegate(ClientLib.Net.CommandResult, this, function(context, data) {
						if (data.m != null){
							for (var i = 0; i < data.m.length; i++) {
								var id = data.m[i].i;
								var name = data.m[i].n;
								var bases = parent.__getBases(id);
								a[name] = {"id": id, "name": name, "bases": bases};
							}
						}
					}), null);
					return a;
			
			},
			
			__getPois: function(aid)
			{
					var a = [];
					ClientLib.Net.CommunicationManager.GetInstance().SendSimpleCommand("GetPublicAllianceInfo", { id: parseInt(aid) }, 
					phe.cnc.Util.createEventDelegate(ClientLib.Net.CommandResult, this, function(context, data) {
						if (data.opois != null) a = data.opois;
					}), null);
					return a;
			},
			
			__getData: function()
			{
				var root = this;
				var data = ClientLib.Data.MainData.GetInstance();
				var alliance_data = data.get_Alliance();
				var alliance_id = alliance_data.get_Id();
				var alliance_name = alliance_data.get_Name();
				var alliance_players = alliance_data.get_MemberDataAsArray();
				var alliance_pois = alliance_data.get_OwnedPOIs();
				var alliance_relations = alliance_data.get_Relationships();
				
				var alliance = {};
					alliance.id = alliance_id;
					alliance.name = alliance_name;
					alliance.pois = alliance_pois;
					
				var players = {};
				alliance_players.map(function(player){
					var playerId = player.Id, playerName = player.Name, bases = root.__getBases(playerId);
					players[playerName] = {"id": playerId, "name": playerName, "bases": bases};
				});
				alliance.players = players;
				
				var selectedAlliances = [];
				selectedAlliances[0] = [alliance_name, alliance, 'alliance'];
				alliance_relations.map(function(x){
					if (x.Relationship == 3)
					{
						var name = x.OtherAllianceName, id = x.OtherAllianceId, type = x.Relationship, players = root.__getPlayers(id), pois = root.__getPois(id);
						var enemy = {"id": id, "name": name, "players": players, "pois": pois};
						selectedAlliances.push([name, enemy, "enemy"]);
					}
				});
				return selectedAlliances;
			}
			
		}
	});
	
	qx.Class.define("ccta_map.container",
	{
		type: "singleton",
		extend: webfrontend.gui.CustomWindow,
		
		construct: function()
		{
			try
			{
				this.base(arguments);
				this.setLayout(new qx.ui.layout.VBox());
				
				this.set({
                    			width: 765,
					height: 550,
                    			caption: "Alliance Map",
                    			padding: 2,
					marginTop: 20,
                    			allowMaximize: false,
                    			showMaximize: false,
                    			allowMinimize: false,
                    			showMinimize: false
                		});
				
				var zoomIn = new qx.ui.form.Button('+');
				var zoomOut = new qx.ui.form.Button('-');
				var grid = new qx.ui.container.Composite(new qx.ui.layout.Grid(3,1));
				var info = new qx.ui.container.Composite(new qx.ui.layout.VBox());
				var canvasContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox())
				var rightBar = new qx.ui.container.Composite(new qx.ui.layout.VBox());
				var leftBar = new qx.ui.container.Composite(new qx.ui.layout.VBox());
				
				canvasContainer.setBackgroundColor('#838a8a');
				rightBar.setBackgroundColor('#838a8a');
				leftBar.setBackgroundColor('#838a8a');
				
				info.set({
					minWidth: 200,
					minHeight: 450,
					marginTop: 10,
					backgroundColor: 'white'
				});
				
				rightBar.setPadding(10);
				
				this.addListener('appear', function()
				{
					try
					{
						var canvas = ccta_map.canvas.getInstance();
					
						rightBar.add(zoomIn);
						rightBar.add(zoomOut);
						rightBar.add(info);
						grid.add(leftBar, {row: 1, column: 1});
						grid.add(rightBar, {row: 1, column: 3});
						grid.add(canvasContainer, {row: 1, column: 2});
						
						zoomIn.addListener('execute', canvas.__zoomIn, this);
						zoomOut.addListener('execute', canvas.__zoomOut, this);
						
						canvasContainer.add(canvas);
						this.add(grid);
						this.canvasContainer = canvasContainer;
						this.info = info;
						
						var showCanvas = function()
						{
							document.getElementById('canvasContainer').appendChild(canvas.div);
							canvas.__drawCanvas();
						};
						
						(document.getElementById('canvasContainer')) ? showCanvas() : setTimeout(showCanvas, 1000);
					}
					catch(e)
					{
						console.log(e.toString());
					}
				}, this);
				
			}
			catch(e)
			{
				console.log(e.toString());
			}
			console.log('container creation completed');
		},
		destruct: function(){},
		members:
		{
			info: null,
			
			__getCanvasContainer: function(){ return this.canvasContainter },
			
			__getInfo: function(){ return this.info },
			
			__setInfo: function(base)			// Gives Error: TypeError: Cannot call method 'removeAll' of undefined //
			{
				try
				{
					var info = this.info;
					info.removeAll();
					if(!base) return;
					for ( var i = 0; i < base.length; i++)
					{
						var label = new qx.ui.basic.Label(base[i]);
						info.add(label);
					}
				}
				catch(e)
				{
					console.log(e.toString());
				}
			}
			
		}
	});
	
	qx.Class.define("ccta_map.canvas",
	{
		type: "singleton",
		extend: qx.ui.core.Widget,
		
		construct: function()
		{
			try
			{
				this.base(arguments);
				this.set({
					width: 500,
					height: 500
				});
				var cont = new qx.html.Element('div', null, {id: "canvasContainer"}),
					div = document.createElement('div'),
					mask = document.createElement('div'),
					canvas = document.createElement('canvas'),
					ctx = canvas.getContext("2d"),
					root = this;
								
				div.style.width = '500px';
				div.style.height = '500px';
				div.style.position = 'absolute';
				div.style.overflow = 'hidden';
				div.style.backgroundColor = '#081d25';
				
				canvas.style.position = 'absolute';
				
				mask.style.position = 'absolute';
				mask.style.width = '500px';
				mask.style.height = '500px';
				mask.style.background = 'url("http://archeikhmeri.co.uk/images/map_mask.png") center center no-repeat';
				
				this.getContentElement().add(cont);
				this.canvas = canvas;
				this.mask = mask;
				this.ctx = ctx;
				
				this.__drawCanvas();
				this.__zoomIn = function(){ if (root.scale < 12) root.__scaleMap('up') };
				this.__zoomOut = function(){if (root.scale > 1) root.__scaleMap('down') };
				this.__draggable(mask);
				
				div.appendChild(canvas);
				div.appendChild(mask);
				this.div = div;
			}
			catch(e)
			{
				console.log(e.toString());
			}
			console.log('canvas creation completed');
		},
		destruct: function(){},
		members:
		{	
			circles: [53, 85, 113, 145, 242],
			
			scale: 1,
			
			selectedBase: false,
			
			elements: [],
			
			inProgress: false,
			
			__createLayout: function()
			{
				var s = this.scale, circles = this.circles, ctx = this.ctx;
				for (var i = 0; i < circles.length; i++) {
					var r = circles[i];
					ctx.beginPath();
					ctx.arc(250, 250, r, 0, Math.PI * 2, true);
					ctx.closePath();
					ctx.lineWidth = i == 4 ? 1/s : 0.3/s;
					ctx.strokeStyle = '#8ce9ef';
					ctx.stroke();
				}
				
				for(var i = 0; i < 8; i++){
					var r = circles[4], a = (Math.PI * i / 4) - Math.PI / 8;
					ctx.beginPath();
					ctx.moveTo(250,250);
					ctx.lineTo((r * Math.cos(a)) + 250, (r * Math.sin(a)) + 250);
					ctx.lineWidth = 0.3/s;
					ctx.strokeStyle = '#8ce9ef';
					ctx.stroke();
					ctx.closePath();
				}
			},
			
			__createAlliance: function(name, data, type)
			{
				try
				{
					this.inProgress = true;
					var colors = {
						"bases": {"alliance":["#86d3fb","#75b7d9"], "owner":["#ffc48b","#d5a677"], "enemy":["#ff8e8b","#dc7a78"], "nap":["#ffffff","#cccccc"], "selected":["#ffe50e", "#d7c109"]},
						"pois": [["#add2a8","#6db064"], ["#75b9da","#4282bd"], ["#abd2d6","#6bafb7"], ["#e2e0b7","#ccc880"], ["#e5c998","#d09e53"], ["#d4a297","#b35a54"], ["#afa3b1","#755f79"]]
					};
					
					var owner = ClientLib.Data.MainData.GetInstance().get_Player().name, ctx = this.ctx;
	
					var createBase = function (x, y, bt) 
					{
						var c = colors.bases[bt][0], r = 0.5, d = colors.bases[bt][1];
						var grd=ctx.createLinearGradient(x-r, y-r, x+r, y+r);
							grd.addColorStop(0, c);
							grd.addColorStop(1, d);
						ctx.beginPath();
						ctx.arc(x, y, 0.5, 0, Math.PI * 2, true);
						ctx.closePath();
						ctx.fillStyle = grd;
						ctx.fill();
						if(this.scale > 3){
							ctx.lineWidth = 0.1;
							ctx.strokeStyle = '#000000';
							ctx.stroke();
						}
					};
					
					var createPoi = function(x, y, t) 
					{
						var c = colors.pois[t][0], d = colors.pois[t][1];
						var grd = ctx.createLinearGradient(x, y, x+1, y+1);
							grd.addColorStop(0, c);
							grd.addColorStop(1, d);
						ctx.beginPath();
						ctx.rect(x, y, 1, 1);
						ctx.fillStyle = grd;
						ctx.fill();
						if(this.scale > 3){
							ctx.strokeStyle = "#000000";
							ctx.lineWidth = 0.1;
							ctx.stroke();
						}
					};
					
					for (var player in data.players) {
						for (var i = 0; i < data.players[player].bases.length; i++){
							var b = data.players[player].bases[i];
							(player == owner) ? createBase(b[0]/2, b[1]/2, 'owner') : createBase(b[0]/2, b[1]/2, type);
							this.elements.push({"x":b[0],"y":b[1],"bn":b[2],"an":name,"pn":player,"l":b[3],"t":"base","ai":data.id,"pi":data.players[player].id})
						}
					}
					for (var i = 0; i < data.pois.length; i++){
						createPoi(data.pois[i].x/2, data.pois[i].y/2, data.pois[i].t - 2);
					}
					this.inProgress = false;
				}
				catch(e)
				{
					console.log(e.toString());
				}
			},
			
			__outlineBase: function(x,y)
			{
				this.__drawCanvas(false);
				var r = 0.5, ctx = this.ctx;
				var grd=ctx.createLinearGradient(x-r, y-r, x+r, y+r);
					grd.addColorStop(0, "#ffe50e");
					grd.addColorStop(1, "#d7c109");
				ctx.beginPath();
				ctx.arc(x, y, 0.5, 0, Math.PI * 2, true);
				ctx.closePath();
				ctx.fillStyle = grd;
				ctx.fill();
				if(this.scale > 3){
					ctx.lineWidth = 0.1;
					ctx.strokeStyle = '#000000';
					ctx.stroke();
				}
			},

			__draggable: function(mask)
			{
				try
				{
					var start, end, initCoords = [], selectedBase = false, elements = this.elements, root = this, canvas = this.canvas, c = 0;
					var win = ccta_map.container.getInstance();
					var setInfo = win.__setInfo;					
					
					var displayBaseInfo = function()
					{
						try
						{
							if (!selectedBase || root.inProgress) return;
							var base = [];
							for ( var i in selectedBase) {
								var txt = "";
								switch(i)
								{
									case "an": txt = "Alliance: " + selectedBase[i]; break;
									case "bn": txt = "Base    : " + selectedBase[i]; break;
									case "pn": txt = "Player  : " +  selectedBase[i]; break;
									case "l" : txt = "Level   : " +  selectedBase[i]; break;
									default  : txt = false;
								}
								if(txt)
								{
									var label = new qx.ui.basic.Label(txt);
									base.push(txt);
								}
								console.log(txt);
								setInfo(base);
							}
						}
						catch(e)
						{
							console.log(e.toString());
						}
					};
					
					var onMapHover = function(event)
					{
						if (root.scale < 4 || root.inProgress) return;
						var getCoords = function()
						{
							var canvasRect = canvas.getBoundingClientRect();
							var x = (event.pageX - canvasRect.left),
								y = (event.pageY - canvasRect.top);
							return [x, y];
						};
						
						var coords = getCoords();
						var x = coords[0] + canvas.offsetLeft, y = coords[1] + canvas.offsetTop;

						if(Math.sqrt(Math.pow(x - 250, 2) + Math.pow(y - 250, 2)) > 242) return;
						
						x = Math.round(coords[0] * 2 / root.scale);
						y = Math.round(coords[1] * 2 / root.scale);

						for(var i in elements){
							var elmX = elements[i].x,
								elmY = elements[i].y;
							if ((x == elmX) && (y == elmY)) 
							{
								selectedBase = elements[i];
								displayBaseInfo();
								return;
							}
							else
							{
								selectedBase = false;
								setInfo(false);
							}
						}
					};
					
					var onMapDrag = function(event)
					{
						if (root.scale == 1 || root.inProgress) return;
						var cx = canvas.offsetLeft, cy = canvas.offsetTop, mx = event.pageX, my = event.pageY;
						var newX = cx + mx - initCoords[0], newY = cy + my - initCoords[1];
						initCoords[0] = mx;
						initCoords[1] = my;
						canvas.style.top = newY + 'px';
						canvas.style.left = newX + 'px';
					};
					
					var onMapWheel = function(event)
					{
						if (root.inProgress) return;
						var delta = Math.max(-1, Math.min(1, (event.wheelDelta || -event.detail)));
						if((delta < 0 && root.scale <= 1) || (delta > 0 && root.scale >= 12)) return;
						c += delta;
						var str = ( Math.abs(c) % 3 == 0 ) ? ((delta < 0) ? 'down' : 'up') : false;
						if(str) root.__scaleMap(str);
						console.log(c, str);
					};

					
					var outlineBase = function()
					{
						if (!selectedBase || root.inProgress) return;
						root.__outlineBase((selectedBase.x)/2, (selectedBase.y)/2);
					};
			
					var onMapDown = function(event){
						var x = event.pageX, y = event.pageY, t = new Date();
						initCoords = [x,y];
						start = t.getTime();
						mask.removeEventListener('mousemove', onMapHover, false);
						mask.addEventListener('mousemove', onMapDrag, false);
					};
					
					var onMapUp = function(event){
						var x = event.pageX, y = event.pageY, t = new Date();
						end = t.getTime();
						initCoords = [x,y];
						mask.removeEventListener('mousemove', onMapDrag, false);
						mask.addEventListener('mousemove', onMapHover, false); 
						if (end - start < 250) outlineBase();
					};
					
					var onMapOut = function(event){
						mask.removeEventListener('mousemove', onMapDrag, false);
						mask.addEventListener('mousemove', onMapHover, false); 
					};
					
					mask.addEventListener('mouseup', onMapUp, false);
					mask.addEventListener('mousedown', onMapDown, false);
					mask.addEventListener('mousemove', onMapHover, false); 
					mask.addEventListener('mouseout', onMapOut, false);
					mask.addEventListener('mousewheel', onMapWheel, false);
					mask.addEventListener('DOMMouseScroll', onMapWheel, false);
				}
				catch(e)
				{
					console.log(e.toString());
				}
			},
			
			__drawCanvas: function()
			{
				var c = ccta_map.getInstance();
				var b = c.data;
				var mask = this.mask, n = this.scale, canvas = this.canvas, ctx = this.ctx;
				canvas.width = n * 500;
				canvas.height = n * 500;
				ctx.scale(n, n);
				this.__createLayout();
				for(var i = 0; i < b.length; i++)
				{
					var name = b[i][0], data = b[i][1], type = b[i][2];
					this.__createAlliance(name, data, type);
				}
			},
				
			__scaleMap: function(str)
			{
				try
				{
					var newScale = (str == 'up') ? this.scale + 2 : this.scale - 2;
					var canvas = this.canvas, ctx = this.ctx;
					var x = ((canvas.offsetLeft - 250) * newScale/this.scale) + 250,
						y = ((canvas.offsetTop - 250) * newScale/this.scale) + 250;
					this.scale = newScale;
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					this.__drawCanvas();
					canvas.style.left = newScale == 1 ? 0 : x + 'px';
					canvas.style.top = newScale == 1 ? 0 : y + 'px';
				}
				catch(e)
				{
					console.log(e.toString());
				}
			}
			
		}
	});
