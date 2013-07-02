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
			var alliance_relations = alliance_data.get_Relationships();
			
			var alliancesList = [];
			alliancesList[0] = [alliance_id, 'alliance'];
							
			alliance_relations.map(function(x)
			{
				var type;
				switch(x.Relationship)
				{
					case 1 : type = "ally";    break;
					case 2 : type = "nap";     break;
					case 3 : type = "enemy";   break;
					default: type = "unknown";
				}
				var id = x.OtherAllianceId;
				alliancesList.push([id, type]);
			});
			
			root.getData(alliancesList);
			
			var mapButton = new qx.ui.form.Button('Map');
			var app = qx.core.Init.getApplication();
			var optionsBar = app.getOptionsBar().getLayoutParent();
			
			mapButton.addListener('execute', function()
			{
				ccta_map.container.getInstance().open();
			}, this);
			
			optionsBar.getChildren()[0].getChildren()[2].addAt(mapButton,1);

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
		__data: null,
		__totalProcesses: null,
		
		getData: function(arr)
		{
			if(typeof arr != "object" || arr.length == 'undefined')
			{
				console.log('alliances list is invalid');
				return;
			}
			this.__data = [];
			this.__totalProcesses = arr.length - 1;
			for(var i = 0; i < arr.length; i++)
			{
				this.__getAlliance(arr[i][0], arr[i][1], i);
			}
		},
		
		__getAlliance: function(aid, type, n)
		{
			try
			{
				var alliance = {}, root = this;
				alliance.id = aid;
				alliance.players = {};
				
				ClientLib.Net.CommunicationManager.GetInstance().SendSimpleCommand("GetPublicAllianceInfo", { id: aid }, 
				phe.cnc.Util.createEventDelegate(ClientLib.Net.CommandResult, this, function(context, data)
				{
					if (data.opois != null) alliance.pois = data.opois;
					if (data.n != null) alliance.name = data.n;
					if (data.m != null)
					{
						data.m.map(function(p)
						{
							var playerName = p.n;
							var playerId   = p.i;
							var player     = {"id": playerId, "name": playerName};
							var bases      = [];
							var lastPlayer = data.m[data.m.length-1];
							
							ClientLib.Net.CommunicationManager.GetInstance().SendSimpleCommand("GetPublicPlayerInfo", { id: playerId }, 
							phe.cnc.Util.createEventDelegate(ClientLib.Net.CommandResult, this, function(context, data)
							{
								if (data.c != null)
								{
									data.c.map(function(b)
									{
										var id   = b.i;
										var name = b.n;
										var x    = b.x
										var y    = b.y;
										bases.push([x, y, name, id]);
									});
									player.bases = bases;
								}
								alliance.players[playerName] = player;
								if(n == root.__totalProcesses && p == lastPlayer) root.__onProcessComplete();
							}), null);
							
						});
						root.__data.push([alliance, type]);
					}
				}), null);
			}
			catch(e)
			{
				console.log(e.toString());
			}
		},
		
		__onProcessComplete: function()
		{
			console.log('process completed - alliances data has been generated', this.__data)
			var win = ccta_map.container.getInstance();
			win.receivedData = this.__data;
			win.drawCanvas();
			this.__totalProcess = null;
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
			var canvasContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox());
			var rightBar = new qx.ui.container.Composite(new qx.ui.layout.VBox());
			var leftBar = new qx.ui.container.Composite(new qx.ui.layout.VBox());
			var widget = new qx.ui.core.Widget();
			var div = new qx.html.Element('div', null, {id: 'canvasContainer'});
			var addAlliance = new qx.ui.form.Button('Add Alliance');
			
			grid.setBackgroundColor('#838a8a');
			widget.set({ width: 500, height: 500 });
			info.set({ minWidth: 160, minHeight: 300, marginTop: 10, padding: 20});
			rightBar.setPadding(10);
			
			
			rightBar.add(zoomIn);
			rightBar.add(zoomOut);
			rightBar.add(info);
			rightBar.add(addAlliance);
			canvasContainer.add(widget);
			widget.getContentElement().add(div);
			grid.add(leftBar, {row: 1, column: 1});
			grid.add(rightBar, {row: 1, column: 3});
			grid.add(canvasContainer, {row: 1, column: 2});
			
			this.info = info;
			
			//canvas
			var cont = document.createElement('div'),
				mask = document.createElement('div'),
				canvas = document.createElement('canvas'),
				ctx = canvas.getContext("2d"),
				root = this;
							
			cont.style.width = '500px';
			cont.style.height = '500px';
			cont.style.position = 'absolute';
			cont.style.overflow = 'hidden';
			cont.style.backgroundColor = '#081d25';
			
			canvas.style.position = 'absolute';
			
			mask.style.position = 'absolute';
			mask.style.width = '500px';
			mask.style.height = '500px';
			mask.style.background = 'url("http://archeikhmeri.co.uk/images/map_mask.png") center center no-repeat';
			
			this.canvas = canvas;
			this.mask = mask;
			this.ctx = ctx;				
			
			var __zoomIn = function(){ if (root.scale < 12) root.__scaleMap('up') };
			var __zoomOut = function(){if (root.scale > 1) root.__scaleMap('down') };
			
			cont.appendChild(canvas);
			cont.appendChild(mask);				
			root.__draggable(mask);
			
			this.addListener('appear', function()
			{
				try
				{					
					var onLoaded = function()
					{
						var counter = 0;
						var check = function()
						{
							if(counter > 60) return;
							var htmlDiv = document.getElementById('canvasContainer');
							(htmlDiv) ? htmlDiv.appendChild(cont) : setTimeout(check, 1000);
							console.log('ccta_map.container/waitForData/showCanvas: retrying check for canvasContainer is loaded');
							counter++;
						};
						check();
					};
					
					onLoaded();
					
					zoomIn.addListener('execute', __zoomIn);
					zoomOut.addListener('execute', __zoomOut);
					addAlliance.addListener('execute', function()
					{
						ccta_map.options.getInstance().open();
					}, this);
					
					this.add(grid);
					
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
		canvas: null,
		mask: null,
		ctx: null,
		receivedData: null,
		info: null,
		circles: [53, 85, 113, 145, 242],
		scale: 1,
		selectedBase: false,
		elements: [],
		locations: [],
		inProgress: false,

		__setInfo: function(base)
		{
			try
			{
//					console.log(base);
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
		},
		
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
					"bases": {"alliance":["#86d3fb","#75b7d9"], "owner":["#ffc48b","#d5a677"], "enemy":["#ff8e8b","#dc7a78"], "nap":["#ffffff","#cccccc"], "selected":["#ffe50e", "#d7c109"], "ally":["#6ce272", "#5fc664"], "unknow": ['#333333', '#999999']},
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
					ctx.closePath();
				};
				
				var createPoi = function(x, y, t) 
				{
					var c = colors.pois[t][0], r = 0.5, d = colors.pois[t][1];
					var grd = ctx.createLinearGradient(x-r, y-r, x+r, y+r);
						grd.addColorStop(0, c);
						grd.addColorStop(1, d);
					ctx.beginPath();
					ctx.rect(x-r, y-r, 1, 1);
					ctx.fillStyle = grd;
					ctx.fill();
					if(this.scale > 3){
						ctx.strokeStyle = "#000000";
						ctx.lineWidth = 0.1;
						ctx.stroke();
					}
					ctx.closePath();
				};
				
				for (var player in data.players) {
					for (var i = 0; i < data.players[player].bases.length; i++){
						var b = data.players[player].bases[i], pid = data.players[player].id;
						(player == owner) ? createBase(b[0]/2, b[1]/2, 'owner') : createBase(b[0]/2, b[1]/2, type);
						this.elements.push({"x":b[0],"y":b[1],"an":name,"pn":player,"bn":b[2],"l":b[3],"ai":data.id,"pi":pid,"type":"base"});
						this.locations.push([b[0],b[1]])
					}
				}
				for (var i = 0; i < data.pois.length; i++){
					var x = data.pois[i].x, y = data.pois[i].y, t = data.pois[i].t, l = data.pois[i].l;
					createPoi(x/2, y/2, t - 2);
					this.elements.push({"x": x, "y": y, "an": name, "ai": data.id, "t": t, "l": l});
					this.locations.push([x, y]);
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
			this.drawCanvas();
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
			ctx.closePath();
		},

		__draggable: function(mask)
		{
			try
			{
				var start, end, initCoords = [], selectedBase = false, root = this, canvas = this.canvas, c = 0;					
				
				var displayBaseInfo = function()
				{
					try
					{
						if (!selectedBase || root.inProgress) return;
						var base = [];
						var pois = ['Tiberium', 'Crystal', 'Reactor', 'Tungesten', 'Uranium', 'Aircraft Guidance', 'Resonater'];
						for ( var i in selectedBase)
						{
							var txt = "";
							switch(i)
							{
								case "an": txt = "Alliance: " + selectedBase[i]; break;
								case "bn": txt = "Base    : " + selectedBase[i]; break;
								case "pn": txt = "Player  : " + selectedBase[i]; break;
								case "l" : txt = "Level   : " + selectedBase[i]; break;
								case "t" : txt = "Type    : " + pois[selectedBase[i] - 2]; break;
								default  : txt = false;
							}
							if(txt)
							{
								base.push(txt);
							}
							root.__setInfo(base);
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
					var loc = root.locations, elements = root.elements;
					var getCoords = function()
					{
						var canvasRect = canvas.getBoundingClientRect();
						var x = (event.pageX - canvasRect.left), y = (event.pageY - canvasRect.top);
						return [x, y];
					};
					
					var coords = getCoords();
					var x = coords[0] + canvas.offsetLeft, y = coords[1] + canvas.offsetTop;

					if(Math.sqrt(Math.pow(x - 250, 2) + Math.pow(y - 250, 2)) > 242) return;
					
					x = Math.round(coords[0] * 2 / root.scale);
					y = Math.round(coords[1] * 2 / root.scale);

					for(var i = 0; i < loc.length; i++)
					{
						var elmX = loc[i][0], elmY = loc[i][1];
						if ((x == elmX) && (y == elmY)) 
						{
							selectedBase = elements[i];
							displayBaseInfo();
							break;
						}
						else
						{
							selectedBase = false;
							root.__setInfo(false);
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
					if (!selectedBase || root.inProgress || selectedBase['type'] !== "base") return;
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
		
		drawCanvas: function()
		{
			this.elements = [];
			this.locations = [];
			var b = this.receivedData;
			var mask = this.mask, n = this.scale, canvas = this.canvas, ctx = this.ctx;
			canvas.width = n * 500;
			canvas.height = n * 500;
			ctx.scale(n, n);
			this.__createLayout();
			for(var i = 0; i < b.length; i++)
			{
				var name = b[i][0].name, data = b[i][0], type = b[i][1];
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
				this.drawCanvas();
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
	
qx.Class.define('ccta_map.options',
{
	type: 'singleton',
	extend: webfrontend.gui.CustomWindow,
	
	construct: function()
	{
		try
		{
			this.base(arguments);
			this.setLayout(new qx.ui.layout.VBox(10));
			this.set({
				width: 200,
				height: 500,
				showMinimize: false,
				showMaximize: false,
			});
			
			this.__getAlliances();
							
			var searchBox = new qx.ui.form.TextField();
				searchBox.setPlaceholder('Search...');
				
			var list = new qx.ui.form.List();
				list.setHeight(300);
				
			var radioButtons = [['Enemy', 'enemy'],['Ally', 'ally'],['NAP', 'nap']];
			var radioGroup = new qx.ui.form.RadioButtonGroup();
				radioGroup.setLayout(new qx.ui.layout.HBox(10));
				radioGroup.setTextColor('#aaaaaa');
				for (var i = 0; i < radioButtons.length; i++)
				{
					var radioButton = new qx.ui.form.RadioButton(radioButtons[i][0]);
						radioButton.setModel(radioButtons[i][1]);
					radioGroup.add(radioButton);
				}
			
			var __createIcon = function(color)
			{
				var canvas = document.createElement("canvas");
				canvas.width = 60;
				canvas.height = 15;
			
				var ctx = canvas.getContext("2d");
				ctx.beginPath();
				ctx.rect(0,0,60,15);
				ctx.fillStyle = color;
				ctx.fill();
				ctx.closePath();
			
				var data = canvas.toDataURL("image/png");
				return data;
			}
			
			var colors = ["#add2a8", "#75b9da", "#abd2d6", "#e2e0b7", "#e5c998", "#d4a297", "#afa3b1"];
				
			var colorSelectBox = new qx.ui.form.SelectBox();
				colorSelectBox.setHeight(28);
				for (var i = 0; i < colors.length; i++)
				{
					try
					{
					var src = __createIcon(colors[i]);
					var listItem = new qx.ui.form.ListItem(null, src);
						listItem.setModel(i);
					
					colorSelectBox.add(listItem);
					}
					catch(e)
					{
						console.log(e.toString());
					}
				}
				
			
			var addButton = new qx.ui.form.Button('Add');
				addButton.setEnabled(false);
				
			this.searchBox      = searchBox;
			this.list           = list;
			this.radioGroup     = radioGroup;
			this.colorSelectBox = colorSelectBox;
			this.addButton      = addButton;
			
			this.add(searchBox);
			this.add(list);
			this.add(radioGroup);
			this.add(colorSelectBox);
			this.add(addButton);
			
			searchBox.addListener('keyup', this.__searchAlliances, this);
			list.addListener('changeSelection', this.__onSelectionChange, this);
			addButton.addListener('execute', this.__addAlliance, this);

		}
		catch(e)
		{
			console.log(e.toString());
		}
		
	},
	destruct: function()
	{
		
	},
	members:
	{
		__data: null,
		searchBox: null,
		list: null,
		radioGroup: null,
		colorSelectBox: null,
		addButton: null,
		
		__getAlliances: function()
		{
			var root = this;
			ClientLib.Net.CommunicationManager.GetInstance().SendSimpleCommand("RankingGetData", 
			{firstIndex: 0, lastIndex: 3000, ascending: true, view: 1, rankingType: 0, sortColumn: 2}, 
			phe.cnc.Util.createEventDelegate(ClientLib.Net.CommandResult, this, function(context, data)
			{
				if(data.a != null)
				{
					var arr = [];
					for( var i = 0; i < data.a.length; i++)
					{
						arr[i] = [data.a[i].an, data.a[i].a];
					}
					root.__data = arr;
				}
				
			}), null);
		},
		
		__searchAlliances: function()
		{
			var str = this.searchBox.getValue(), data = this.__data, list = this.list;
			if (!data)
			{
				console.log('no data available');
				return;
			}
			list.removeAll();
			if (str == '') return;
			data.map(function(x)
			{
				var patt = new RegExp("^" + str + ".+$", "i");
				var test = patt.test(x[0]);
				
				if(test)
				{
					var listItem = new qx.ui.form.ListItem(x[0]);
					listItem.setModel(x[1]);
					list.add(listItem);
				}
				
			});
		},
		
		__onSelectionChange: function()
		{
			(!this.list.isSelectionEmpty()) ? this.addButton.setEnabled(true) : this.addButton.setEnabled(false);
		},
		
		__addAlliance: function()
		{
			var aid = this.list.getSelection()[0].getModel(), 
				type = this.radioGroup.getSelection()[0].getModel(), 
				color = this.colorSelectBox.getSelection()[0].getModel();
				
			console.log(aid, type, color);
		}
		
	}
});
