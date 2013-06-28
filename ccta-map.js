  qx.Class.define("ccta_map", 
	{
		type: "singleton",
		extend: qx.core.Object,
		
		construct: function()
		{
			try
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
				this.selectedAlliances = selectedAlliances;
				
				var mapButton = new qx.ui.form.Button('Map');
				var app = qx.core.Init.getApplication();
                var optionsBar = app.getOptionsBar().getLayoutParent();
				
				mapButton.addListener('execute', function()
				{
					ccta_map.container.getInstance().open();
				}, this);
				
				optionsBar.add(mapButton)

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
					marginLeft: 10,
					marginTop: 10,
					backgroundColor: 'white'
				});
				
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
						this.info = info;
						if(document.getElementById('canvasContainer'))
						{
							document.getElementById('canvasContainer').appendChild(canvas.div);
						}
						else{
							setTimeout(function(){ document.getElementById('canvasContainer').appendChild(canvas.div) }, 1000);
						}
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
			__getCanvasContainer: function(){ return this.canvasContainter },
			
			__getInfo: function(){ return this.info }
			
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
					data = ccta_map.getInstance().selectedAlliances,
					root = this,
					onHover = this.__onMapHover;
				
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
				this.data = data;
				
				this.__drawCanvas();
				this.__zoomIn = function(){ if (root.scale < 12) root.__scaleMap('up') };
				this.__zoomOut = function(){if (root.scale > 1) root.__scaleMap('down') };
				
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
					var colors = {
						"bases": {"alliance":["#86d3fb","#75b7d9"], "owner":["#ffc48b","#d5a677"], "enemy":["#ff8e8b","#dc7a78"], "nap":["#ffffff","#cccccc"], "selected":["#ffe50e", "#d7c109"]},
						"pois": [["#add2a8","#6db064"], ["#75b9da","#4282bd"], ["#abd2d6","#6bafb7"], ["#e2e0b7","#ccc880"], ["#e5c998","#d09e53"], ["#d4a297","#b35a54"], ["#afa3b1","#755f79"]]
					};
					
					var owner = ClientLib.Data.MainData.GetInstance().get_Player().name, ctx = this.ctx;
	
					var createBase = function (x, y, bt) 
					{
						var c = colors.bases[bt][0], r = 0.5, d = colors.bases[bt][1];
						var r = 0.5;
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
						for (var base in data.players[player].bases){
							var b = data.players[player].bases[base];
							(player == owner) ? createBase(b[0]/2, b[1]/2, 'owner') : createBase(b[0]/2, b[1]/2, type);
							this.elements.push({"x":b[0],"y":b[1],"bn":b[2],"an":name,"pn":player,"l":b[3],"t":"base","ai":data.id,"pi":data.players[player].id})
						}
					}
					for (var x in data.pois){
						createPoi(data.pois[x].x/2, data.pois[x].y/2, data.pois[x].t - 2);
					}
				}
				catch(e)
				{
					console.log(e.toString());
				}
			},

			__draggable: function(mask)
			{
				try
				{
					var start, end, initCoords = [], selectedBase = false, elements = this.elements, root = this, canvas = this.canvas, c = 0;
					var cont = ccta_map.container.getInstance().info;
					console.log(cont)					
					
					var onMapHover = function(e)
					{
						if (this.scale < 6) return;
						
						var getCoords = function()
						{
							var canvasRect = canvas.getBoundingClientRect();
							var x = (e.pageX - canvasRect.left),
								y = (e.pageY - canvasRect.top);
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
								displayBaseInfo();
							}
						}
					};
					
					var onMapDrag = function(e)
					{
						if (root.scale == 1) return;
						var cx = canvas.offsetLeft, cy = canvas.offsetTop, mx = e.pageX, my = e.pageY;
						var newX = cx + mx - initCoords[0], newY = cy + my - initCoords[1];
						initCoords[0] = mx;
						initCoords[1] = my;
						canvas.style.top = newY + 'px';
						canvas.style.left = newX + 'px';
					};
					
					var onMouseWheel = function()
					{
						var e = window.event || e, s = root.scale;
						var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
						if((delta < 0 && s <= 1) || (delta > 0 && s >= 12)) return;
						c += delta;
						var str = ( Math.abs(c) % 6 == 0 ) ? (delta < 0) ? 'down' : 'up' : false;
						if(str) root.__scaleMap(str);
					};

					
					var outlineBase = function()
					{
						if (!selectedBase) return;
						root.__createBase(selectedBase.x/2, selectedBase.y/2, 'selected');
					};
					
					var displayBaseInfo = function()
					{

//						if(cont.removeAll) cont.removeAll();
						if (!selectedBase) return;
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
//							if(txt) var label = new qx.ui.basic.Label(txt);
//							cont.add(label);
							console.log(txt);
						}
					};
			
					mask.onmousedown = function(event){
						var x = event.pageX, y = event.pageY;
						initCoords = [x,y];
						mask.onmousemove = function(event){ onMapDrag(event) };
						start = (new Date()).getTime();
					};
					mask.onmouseup = function(event){
						end = (new Date()).getTime();
						var x = event.pageX, y = event.pageY;
						initCoords = [x,y];
						mask.onmousemove = function(event){ onMapHover(event) };
						if (end - start < 250) outlineBase();
					};
					mask.onmouseout = function(event){
						mask.onmousemove = function(event){ onMapHover(event) };
					};
					mask.addEventListener('mousewheel', onMouseWheel, false);
					mask.addEventListener('DOMMouseScroll', onMouseWheel, false);
				}
				catch(e)
				{
					console.log(e.toString());
				}
			},
			
			__drawCanvas: function()
			{
				var b = this.data, mask = this.mask, n = this.scale, canvas = this.canvas, ctx = this.ctx;
				canvas.width = n * 500;
				canvas.height = n * 500;
				ctx.scale(n, n);
				this.__createLayout();
				for(var i = 0; i < b.length; i++)
				{
					var name = b[i][0], data = b[i][1], type = b[i][2];
					this.__createAlliance(name, data, type);
				}
				this.__draggable(mask);
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
