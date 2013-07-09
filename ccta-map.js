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
				var alliance_exists = alliance_data.get_Exists();
				
				if(alliance_exists)
				{
					var alliance_name = alliance_data.get_Name();
					var alliance_id = alliance_data.get_Id();
					var alliance_relations = alliance_data.get_Relationships();
					
					this.__allianceId = alliance_id;
					this.__allianceName = alliance_name;
					
					var selectedAlliancesList = [];
					selectedAlliancesList[0] = [alliance_id, 'alliance', alliance_name];
									
					if (alliance_relations != null)
					{
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
							var name = x.OtherAllianceName;
							selectedAlliancesList.push([id, type, name]);
						});
					}
					this.__defaultAlliances = selectedAlliancesList;
				}
								
				var mapButton = new qx.ui.form.Button('Map');
				var app = qx.core.Init.getApplication();
				var optionsBar = app.getOptionsBar().getLayoutParent();
				
				mapButton.addListener('execute', function()
				{
					root.getData();
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
			__allianceName: null,
			__allianceId: null,
			__defaultAlliances: null,
			__selectedAlliances: null,
			__data: null,
			__totalProcesses: null,
			
			getData: function()
			{
				var arr = (this.__selectedAlliances == null) ? this.__defaultAlliances : this.__selectedAlliances;
				
				if(arr != null)
				{
					this.__data = [];
					this.__totalProcesses = arr.length - 1;
					for(var i = 0; i < arr.length; i++)
					{
						this.__getAlliance(arr[i][0], arr[i][1], i);
					}
				}
			},
			
			__getAlliance: function(aid, type, n)
			{
				try
				{
					var alliance = {}, root = this;
					alliance.id = aid;
					alliance.players = {};
					var totalProcesses = this.__totalProcesses;
					
					var getBases = function(pid, pn, p, tp, an)
					{
						ClientLib.Net.CommunicationManager.GetInstance().SendSimpleCommand("GetPublicPlayerInfo", { id: pid }, 
						phe.cnc.Util.createEventDelegate(ClientLib.Net.CommandResult, this, function(context, data)
						{
							if (data.c != null)
							{
								var totalBases = data.c.length;
								var player = {};
								var bases = [];
								
								for (var b = 0; b < data.c.length; b++)
								{
									var id   = data.c[b].i;
									var name = data.c[b].n;
									var x    = data.c[b].x
									var y    = data.c[b].y;
									bases.push([x, y, name, id]);
									console.log(totalProcesses, n, an, tp, p, pn, totalBases, b, name);
									if((n == totalProcesses) && (p == tp - 1) && (b == totalBases - 1)) root.__onProcessComplete();
								}
								player.id = pid;
								player.name = pn;
								player.bases = bases;
								alliance.players[pn] = player;
							}
							alliance.players[pn] = player;
						}), null);
					};
					
					ClientLib.Net.CommunicationManager.GetInstance().SendSimpleCommand("GetPublicAllianceInfo", { id: aid }, 
					phe.cnc.Util.createEventDelegate(ClientLib.Net.CommandResult, this, function(context, data)
					{
						if (data.opois != null) alliance.pois = data.opois;
						if (data.n != null) alliance.name = data.n;
						if (data.m != null)
						{
							
							for (var p = 0; p < data.m.length; p++)
							{
								var playerName = data.m[p].n;
								var playerId   = data.m[p].i;
								getBases(playerId, playerName, p, data.m.length, alliance.name);								
							}
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
				win.__updateList();
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
					zoomIn.setWidth(40);
				var zoomOut = new qx.ui.form.Button('-');
					zoomOut.setWidth(40);
				var zoomReset = new qx.ui.form.Button('R');
					zoomReset.setWidth(40);
				var grid = new qx.ui.container.Composite(new qx.ui.layout.Grid(3,1));
				var info = new qx.ui.container.Composite(new qx.ui.layout.VBox());
				var canvasContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox());
				var rightBar = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
				var leftBar = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
				var widget = new qx.ui.core.Widget();
				var div = new qx.html.Element('div', null, {id: 'canvasContainer'});
				
				
				var displayMode = new qx.ui.form.SelectBox();
					displayMode.setHeight(28)
				var li1 = new qx.ui.form.ListItem('All');
					li1.setModel("all");
				var li2 = new qx.ui.form.ListItem('My Bases');
					li2.setModel("bases");
				var li3 = new qx.ui.form.ListItem('My Alliance');
					li3.setModel("alliance");
				displayMode.add(li3);
				displayMode.add(li2);
				displayMode.add(li1);
//				displayMode.setSelection(li3);
				
				var zoomBar = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
				
				var displayOptions = new qx.ui.form.RadioButtonGroup();
					displayOptions.setLayout(new qx.ui.layout.HBox(10));
				var bothOpt = new qx.ui.form.RadioButton('Both');
					bothOpt.setModel("both");
				var basesOpt = new qx.ui.form.RadioButton('Bases');
					basesOpt.setModel("bases");
				var poisOpt = new qx.ui.form.RadioButton('POIs');
					poisOpt.setModel("pois");
				displayOptions.add(bothOpt);
				displayOptions.add(basesOpt);
				displayOptions.add(poisOpt);
				
				var allianceList = new qx.ui.form.List();
				
				var editAlliance = new qx.ui.form.Button('Edit Alliances');
				
				var label = new qx.ui.basic.Label('Transparency');
				
				var slider = new qx.ui.form.Slider();
					slider.set({minimum: 30, maximum: 100, value: 100});
				
				var coordsField = new qx.ui.form.TextField();
					coordsField.set({margin: 20, textAlign: 'center', readOnly: 'true'});
				
				grid.setBackgroundColor('#838a8a');
				widget.set({ width: 500, height: 500 });
				info.set({ minWidth: 160, minHeight: 300, padding: 10});
				rightBar.setPadding(10)
				leftBar.setPadding(10);
				
				
				zoomBar.add(zoomIn);
				zoomBar.add(zoomOut);
				zoomBar.add(zoomReset);
				
				rightBar.add(zoomBar);
				rightBar.add(displayMode);
				rightBar.add(displayOptions);
				rightBar.add(allianceList);
				rightBar.add(editAlliance);
				rightBar.add(label);
				rightBar.add(slider);
				
				leftBar.add(coordsField);
				leftBar.add(info);
				
				canvasContainer.add(widget);
				widget.getContentElement().add(div);
				grid.add(leftBar, {row: 1, column: 1});
				grid.add(rightBar, {row: 1, column: 3});
				grid.add(canvasContainer, {row: 1, column: 2});
				
				this.info = info;
				this.coordsField = coordsField;
				this.allianceList = allianceList;
				
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
				canvas.style.backgroundColor = '#081d25';
				
				mask.style.position = 'absolute';
				mask.style.width = '500px';
				mask.style.height = '500px';
				mask.style.background = 'url("http://archeikhmeri.co.uk/images/map_mask.png") center center no-repeat';
				
				this.canvas = canvas;
				this.mask = mask;
				this.ctx = ctx;				
				
				var __zoomIn = function(){ if (root.scale < 12) root.__scaleMap('up') };
				var __zoomOut = function(){if (root.scale > 1) root.__scaleMap('down') };
				var __zoomReset = function()
				{
					canvas.width = 500;
					canvas.height = 500;
					canvas.style.left = 0;
					canvas.style.top = 0;
					root.scale = 1;
					root.drawCanvas();
				};
				
				cont.appendChild(canvas);
				cont.appendChild(mask);				
				root.__draggable(mask);
				root.resetMap();
				
				slider.addListener('changeValue', function(e)
				{
					this.setOpacity(e.getData() / 100);
				}, this);
				
				allianceList.addListener('changeSelection', function(e)
				{
					if ((root.__displayM != "all") || !e.getData()[0]) return;
					var aid = e.getData()[0].getModel();
					root.__selectedA = aid;
					root.drawCanvas();
				}, this);
								
				displayMode.addListener('changeSelection', function(e)
				{
					var dm = e.getData()[0].getModel();
					console.log(dm);
					root.__displayM = dm;
					root.__updateList();
					
					if(dm == "bases")
					{
						displayOptions.setSelection([basesOpt]);
						poisOpt.setEnabled(false);
						bothOpt.setEnabled(false);
						root.__displayO = "bases";
					}
					else
					{
						if(!poisOpt.isEnabled()) poisOpt.setEnabled(true);
						if(!bothOpt.isEnabled()) bothOpt.setEnabled(true);
						displayOptions.setSelection([bothOpt]);
						root.__displayO = "both";
					}
					root.drawCanvas();
				}, this);
				
				displayOptions.addListener('changeSelection', function(e)
				{
					var dop = e.getData()[0].getModel();
					root.__displayO = dop;
					root.drawCanvas();
				}, this);
				
				editAlliance.addListener('execute', function()
				{
					ccta_map.options.getInstance().open();
				}, this);
				
				zoomIn.addListener('execute', __zoomIn, this);
				zoomOut.addListener('execute', __zoomOut, this);
				zoomReset.addListener('execute', __zoomReset, this);
				
				this.add(grid);
				
				var onLoaded = function()
				{
					var counter = 0;
					var check = function()
					{
						if(counter > 60) return;
						var htmlDiv = document.getElementById('canvasContainer');
						(htmlDiv) ? htmlDiv.appendChild(cont) : setTimeout(check, 1000);
						console.log('retrying check for canvasContainer is loaded');
						counter++;
					};
					check();
				};
				onLoaded();
				
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
			coordsField: null,
			canvas: null,
			mask: null,
			ctx: null,
			receivedData: null,
			allianceList: null,
			circles: [53, 85, 113, 145, 242],
			scale: 1,
			selectedBase: false,
			elements: [],
			locations: [],
			inProgress: false,
			isRadarVisible: false,
			__interval: null,
			__pointerX: null,
			__pointerY: null,
			__selectedA: null,
			__selectedB: null,
			__displayM: "alliance",
			__displayO: "both",

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
					var dop = this.__displayO, dmd = this.__displayM;
					
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
					
					if (dop != "pois")
					{
						for (var player in data.players) {
							for (var i = 0; i < data.players[player].bases.length; i++){
								var b = data.players[player].bases[i], pid = data.players[player].id;
								if(dmd == "bases")
								{
									if (player == owner)
									{
										this.elements.push({"x":b[0],"y":b[1],"an":name,"pn":player,"bn":b[2],"l":b[3],"ai":data.id,"pi":pid,"type":"base"});
										this.locations.push([b[0],b[1]]);
										createBase(b[0]/2, b[1]/2, 'owner');
									}
								}
								else
								{
									this.elements.push({"x":b[0],"y":b[1],"an":name,"pn":player,"bn":b[2],"l":b[3],"ai":data.id,"pi":pid,"type":"base"});
									this.locations.push([b[0],b[1]]);
									(player == owner) ? createBase(b[0]/2, b[1]/2, 'owner') : createBase(b[0]/2, b[1]/2, type);
								}
							}
						}
					}
					
					if (dop != "bases")
					{
						for (var i = 0; i < data.pois.length; i++){
							var x = data.pois[i].x, y = data.pois[i].y, t = data.pois[i].t, l = data.pois[i].l;
							createPoi(x/2, y/2, t - 2);
							this.elements.push({"x": x, "y": y, "an": name, "ai": data.id, "t": t, "l": l});
							this.locations.push([x, y]);
						}
					}
					this.inProgress = false;
				}
				catch(e)
				{
					console.log(e.toString(), e);
				}
			},
			
			__outlineBase: function(x,y)
			{
				this.drawCanvas();
				var r = 0.5, ctx = this.ctx;
				var grd = ctx.createLinearGradient(x-r, y-r, x+r, y+r);
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
						var loc = root.locations, elements = root.elements, coordsField = root.coordsField;
						var getCoords = function()
						{
							var canvasRect = canvas.getBoundingClientRect();
							var x = (event.pageX - canvasRect.left), y = (event.pageY - canvasRect.top);
							return [x, y];
						};
						
						var coords = getCoords();
						var x = coords[0] + canvas.offsetLeft, y = coords[1] + canvas.offsetTop;

						if(Math.sqrt(Math.pow(x - 250, 2) + Math.pow(y - 250, 2)) > 242)
						{
							coordsField.setValue("");
							return;
						}
						
						x = Math.round(coords[0] * 2 / root.scale); root.__pointerX = x;
						y = Math.round(coords[1] * 2 / root.scale); root.__pointerY = y;
						
						coordsField.setValue(x + ":" + y);
						
						if (root.scale < 4 || root.inProgress) return;

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
						if (end - start < 150) webfrontend.gui.UtilView.centerCoordinatesOnRegionViewWindow(root.__pointerX, root.__pointerY);
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
			
			__startRadarScan: function()
			{
				this.isRadarVisible = true;
				var FRAMES_PER_CYCLE = 20, FRAMERATE = 20, RINGS = 6;
				var canvas = this.canvas, ctx = this.ctx, canvassize = 400, animationframe = 0, root = this;
				var ringsize = canvassize / (2 * RINGS + 1);
				var radiusmax = ringsize / 2 + ringsize + (RINGS - 1) * ringsize;
			
				function animateRadarFrame() {
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					root.__createLayout();
					var radius, alpha;
					for (var ringno = 0; ringno < RINGS; ringno++)
					{
						radius = ringsize / 2 + (animationframe / FRAMES_PER_CYCLE) * ringsize + ringno * ringsize;
						alpha = (radiusmax - radius) / radiusmax;
						ctx.beginPath();
						ctx.fillStyle = "rgba(92,178,112," + alpha + ")";
						ctx.arc(250, 250, radius, 0, 2 * Math.PI, false);
						ctx.fill();
					}
			
					ctx.beginPath();
					ctx.fillStyle = "rgb(100,194,122)";
					ctx.arc(250, 250, ringsize / 2, 0, 2 * Math.PI, false);
					ctx.fill();
			
					animationframe = (animationframe >= (FRAMES_PER_CYCLE - 1)) ?  0 :  animationframe + 1;
				}
				this.__interval = setInterval(animateRadarFrame, 1000 / FRAMERATE);
			},
			
			__stopRadarScan: function()
			{
				if(!this.isRadarVisible) return;
				clearInterval(this.__interval);
				this.isRadarVisible = false;
			},
			
			__updateList: function()
			{
				var dm = this.__displayM;
				this.__selectedA = null;
				this.allianceList.removeAll();
				for (var i = 0; i < this.receivedData.length; i++)
				{
					var name = this.receivedData[i][0].name, type = this.receivedData[i][1], aid = this.receivedData[i][0].id;
					if(dm == "all")
					{
						var li = new qx.ui.form.ListItem(name + " - " + type, null, aid);
						this.allianceList.add(li)
					}
					else
					{
						if(type == "alliance")
						{
							var li = new qx.ui.form.ListItem(name + " - " + type, null, aid);
							this.allianceList.add(li);
							break;
						}
					}
				}
			},
			
			drawCanvas: function()
			{
				var dmd = this.__displayM, b = this.receivedData, list = this.allianceList;
				var selected = (this.__selectedA != null && typeof this.__selectedA == 'number') ? this.__selectedA : false;
				var mask = this.mask, n = this.scale, canvas = this.canvas, ctx = this.ctx;
				
				this.elements = [];
				this.locations = [];
				this.__stopRadarScan();
				canvas.width = n * 500;
				canvas.height = n * 500;
				ctx.scale(n, n);
				
				this.__createLayout();
				
				for (var i = 0; i < b.length; i++)
				{
					var name = b[i][0].name, data = b[i][0], type = b[i][1], aid = b[i][0].id;
					if(((dmd == "alliance") || (dmd == "bases")) && (type == "alliance"))
					{
						this.__createAlliance(name, data, type);
						break;
					}
					if(dmd == "all")
					{
						if(selected && (aid == selected)) type = 'selected';
						this.__createAlliance(name, data, type);
					}
				}
			},
				
			__scaleMap: function(str)
			{
				try
				{
					var newScale = (str == 'up') ? this.scale + 2 : this.scale - 2;
					if (newScale > 12 || newScale < 1) return;
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
			},
			
			resetMap: function()
			{
				var canvas = this.canvas, ctx = this.ctx;
				this.scale = 1;
				canvas.width = 500; canvas.height = 500; canvas.style.left = 0; canvas.style.top = 0;
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				this.__startRadarScan();
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
				alwaysOnTop: true
			});
			
			this.__getAlliances();
			
			var root = this;
							
			var searchBox = new qx.ui.form.TextField();
				searchBox.setPlaceholder('Search...');
				
			var list = new qx.ui.form.List();
				list.setHeight(80);
				
			var editList = new qx.ui.form.List();
				editList.setHeight(160);
				editList.setSelectionMode('additive');
				
			var map = ccta_map.getInstance();
			var selectedItems = [];
			var alliancesList = (map.__selectedAlliances == null) ? map.__defaultAlliances : map.__selectedAlliances;
			
			alliancesList.map(function(a)
			{
				var aid = a[0], an  = a[2], at  = a[1];
				var li = new qx.ui.form.ListItem(an + " - " + at, null, {'aid': aid, 'type': at, 'name': an});
				editList.add(li);
				selectedItems.push(aid);
			});
			this.__items = selectedItems;
				
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
						var listItem = new qx.ui.form.ListItem(null, src, i);
						colorSelectBox.add(listItem);
					}
					catch(e)
					{
						console.log(e.toString());
					}
				}
				
			
			var addButton = new qx.ui.form.Button('Add');
				addButton.setEnabled(false);
				
			var removeButton = new qx.ui.form.Button('Remove');
				removeButton.setEnabled(false);
			
			var applyButton = new qx.ui.form.Button('Apply');
			var defaultsButton = new qx.ui.form.Button('Defaults');
				
			this.searchBox      = searchBox;
			this.list           = list;
			this.editList       = editList;
			this.radioGroup     = radioGroup;
			this.colorSelectBox = colorSelectBox;
			this.addButton      = addButton;
			this.removeButton   = removeButton;
			
			this.add(searchBox);
			this.add(list);
			this.add(editList);
			this.add(radioGroup);
			this.add(colorSelectBox);
			this.add(addButton);
			this.add(removeButton);
			this.add(defaultsButton);
			this.add(applyButton);
			
			searchBox.addListener('keyup', this.__searchAlliances, this);
			
			list.addListener('changeSelection', function(e)
			{
				if (!e.getData()[0]) return;
				var items = this.__items, aid = e.getData()[0].getModel();
				((items != null) && (items.indexOf(aid) > -1)) ? addButton.setEnabled(false) : addButton.setEnabled(true);
				console.log(aid, items, items.indexOf(aid));
			}, this);
			
			editList.addListener('changeSelection', function(e)
			{
				(e.getData()[0]) ? removeButton.setEnabled(true) : removeButton.setEnabled(false);
			}, this);
			
			addButton.addListener('execute', function()
			{
				var aid = list.getSelection()[0].getModel(), 
					name = list.getSelection()[0].getLabel(),
					type = radioGroup.getSelection()[0].getModel(), 
					color = colorSelectBox.getSelection()[0].getModel();
				
				var li = new qx.ui.form.ListItem(name + " - " + type, null, {'aid': aid, 'type': type, 'name': name});
				editList.add(li);
				list.resetSelection();
				addButton.setEnabled(false);
				console.log(aid, name, type, color);
				root.__updateItems();
			}, this);
			
			removeButton.addListener('execute', function()
			{
				var selection = (editList.isSelectionEmpty()) ? null : editList.getSelection();
				if(selection != null)
				{
					for(var i = selection.length - 1; i > -1; i--) editList.remove(selection[i]);
					root.__updateItems();
				}
			}, this);
			
			applyButton.addListener('execute', this.__applyChanges, this);

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
		editList: null,
		radioGroup: null,
		colorSelectBox: null,
		addButton: null,
		removeButton: null,
		__items: null,
		
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
			list.removeAll();
			if (!data || (str == '')) return;
			
			data.map(function(x)
			{
				var patt = new RegExp("^" + str + ".+$", "i");
				var test = patt.test(x[0]);
				
				if(test)
				{
					var listItem = new qx.ui.form.ListItem(x[0], null, x[1]);
					list.add(listItem);
				}
			});
		},
		
		__updateItems: function()
		{
			var items = [], listItems = this.editList.getSelectables();
			for(var i = 0; i < listItems.length; i++)
			{
				items.push(listItems[i].getModel().aid);
			}
			this.__items = items;
			console.log(this.__items, this.editList.getSelectables().length);
		},
		
		__applyChanges: function()
		{
			var selectedAlliances = [], listItems = this.editList.getSelectables();
			for(var i = 0; i < listItems.length; i++)
			{
				var model = listItems[i].getModel(), aid = model.aid, type = model.type, name = model.name;
				selectedAlliances.push([aid, type, name]);
			}
			this.close();
			ccta_map.getInstance().__selectedAlliances = selectedAlliances;
			ccta_map.container.getInstance().resetMap();
			ccta_map.getInstance().getData();
			console.log(ccta_map.getInstance().__selectedAlliances, this.__items)
		}
		
	}
});
