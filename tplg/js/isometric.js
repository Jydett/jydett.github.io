// A simple isometric tile renderer

const CELL_OFFSET = {
    1002: 6,
    1003: 7,
    1004: 3,
    1005: 2,
    1006: 5, 
    1007: 4,
    1008: 1,
    1009: 0
}

const IsometricMap = {
    info: {
        "coachPos": [],
        "startingPointTeam1": [],
        "specialCells": [],
        "startingPointTeam0": [],
    },
    map: []
};


const Isometric = {
    id: 5,
    tileColumnOffset: 32, // pixels
    tileRowOffset: 16, // pixels
    ZOffset: -4, // pixels
    altitudePadding: 4,
    specialCaseHashBais: 100,
    hideOffMap: false,
    x: 0,
    y: 0,

    originX: 0, // offset from left
    originY: 0, // offset from top

    Xtiles: 18, // Number of tiles in X-dimension
    Ytiles: 18, // Number of tiles in Y-dimension

    selectedTileX: -1,
    selectedTileY: -1,

    context: undefined,
    canvas: undefined,

    minX: 0, maxX: 0,
    minY: 0, maxY: 0,

    showCoordinates: false,
    drawSpecialCellsImg: false,
    specialCellsImg: new Image(),

    run: function () {
        this.init();
        this.changeMap(this.id)
    },

    init: function () {
        this.specialCellsImg.src = "./css/bonus_guide.png";
        this.canvas = $('#isocanvas');
        $('#mapSelect').on('change', (e) => {
            this.changeMap(parseInt(e.target.value));
        });
        this.context = this.canvas[0].getContext("2d");

        this.loadSettings();

        const self = this;
        $(window)
            .on('resize', function () {
                self.loadMapDataInCanvas();
                self.redrawTiles();
            });

        let canvasEL = document.getElementById('isocanvas');

        // Track the last mouse position
        let lastMouseX;
        let lastMouseY;

        $(window)
            .on('mousedown', function (event) {
                lastMouseX = event.clientX;
                lastMouseY = event.clientY;
            });

        $(window)
            .keydown(function (event) {
                console.log(event.which)
                if (event.which === 37) { // <=
                    self.y--;
                    self.redrawTiles();
                } else if (event.which === 39) { // =>
                    self.y++;
                    self.redrawTiles();
                } else if (event.which === 40) { // \/
                    self.x++;
                    self.redrawTiles();
                } else if (event.which === 38) { // /\
                    self.x--;
                    self.redrawTiles();
                } else if (event.which === 77) {
                    self.hideOffMap = !self.hideOffMap;
                    self.saveSettings();
                    self.redrawTiles();
                } else if (event.which === 83) {
                    self.drawSpecialCellsImg = !self.drawSpecialCellsImg;
                    self.saveSettings();
                    self.redrawTiles();
                } else if (event.which === 80) {
                    if (self.altitudePadding === 0) {
                        self.altitudePadding = 4;
                    } else {
                        self.altitudePadding = 0;
                    }
                    self.saveSettings();
                    self.redrawTiles();
                } else if (event.which === 90) {
                    if (self.ZOffset === 0) {
                        self.ZOffset = -4;
                    } else {
                        self.ZOffset = 0;
                    }
                    self.saveSettings();
                    self.redrawTiles();
                }
            })

        $(window)
            .on('mousemove', function (e) {
                e.pageX = e.pageX - self.tileColumnOffset / 2 - self.originX;
                e.pageY = e.pageY - self.tileRowOffset / 2 - self.originY;
                tileX = Math.round(e.pageX / self.tileColumnOffset - e.pageY / self.tileRowOffset);
                tileY = Math.round(e.pageX / self.tileColumnOffset + e.pageY / self.tileRowOffset);

                self.selectedTileX = tileY;
                self.selectedTileY = -tileX;

                if (self.isCursorOnMap()) {
                    // const guessed =(-tileX - self.minX) * (self.Xtiles + 1) + (tileY - self.minY);
                    // let element = IsometricMap.tplg[guessed];
                    // console.log("guessed", guessed, element)
                    // self.selected = element
                }

                if (e.buttons === 1) {
                    // Calculate the distance moved by the mouse
                    const deltaX = e.clientX - lastMouseX;
                    const deltaY = e.clientY - lastMouseY;

                    // Update the origin based on the mouse movement
                    self.originX += deltaX;
                    self.originY += deltaY;

                    // Redraw the scene with the new origin

                    // Update the last mouse position
                    lastMouseX = e.clientX;
                    lastMouseY = e.clientY;
                }
                self.redrawTiles();
            });

        $(window)
            .on('click', function () {
                console.log(-self.selectedTileX, self.selectedTileY)
                self.showCoordinates = !self.showCoordinates;
                self.redrawTiles();
            });
    },

    loadSettings: function () {
        let item = localStorage.getItem("settings");
        if (item != null) {
            let settings = JSON.parse(item);
            this.hideOffMap = settings['hideOffMap'] ?? this.hideOffMap;
            this.ZOffset = settings['ZOffset'] ?? this.ZOffset;
            this.altitudePadding = settings['altitudePadding'] ?? this.altitudePadding;
            this.drawSpecialCellsImg = settings['drawSpecialCellsImg'] ?? this.drawSpecialCellsImg;
        }
    },

    saveSettings: function () {
        let settings = {
            hideOffMap: this.hideOffMap,
            ZOffset: this.ZOffset,
            altitudePadding: this.altitudePadding,
            drawSpecialCellsImg: this.drawSpecialCellsImg
        }
        localStorage.setItem("settings", JSON.stringify(settings));
    },

    loadMapDataInCanvas: function () {
        const width = $(window)
            .width();
        const height = $(window)
            .height();

        this.context.canvas.width = width;
        this.context.canvas.height = height;

        const numberOfCells = IsometricMap.map.length
        this.maxX = 0;
        this.minX = 0;
        this.maxY = 0;
        this.minY = 0;
        IsometricMap.tplg = []
        for (let i = 0; i < numberOfCells; i++) {
            let cell = IsometricMap.map[i];
            IsometricMap.tplg.push(cell)
            cell.hash = this.packCoordinates(cell.x, cell.y, cell.z);
            if (cell.x > this.maxX) {
                this.maxX = cell.x;
            }
            if (cell.x < this.minX) {
                this.minX = cell.x;
            }
            if (cell.y > this.maxY) {
                this.maxY = cell.y;
            }
            if (cell.y < this.minY) {
                this.minY = cell.y;
            }
            switch (cell.cost) {
                case 15 :
                    cell.color = '#FF0000';
                    break
                case -1 :
                    cell.color = '#F00000';
                    break;
                default:
                    cell.color = '#FFFFFF';
                    break
            }
            cell.shape = 'D';
        }

        this.importData();

        const numberOfSpecialCells = IsometricMap.info.specialCells.length
        for (let i = 0; i < numberOfSpecialCells; i++) {
            let specialCell = IsometricMap.info.specialCells[i];
            // this.drawCross(-specialCell.position.y, specialCell.position.x, specialCell.position.z, 'yellow', 0);
            specialCell.position.hash = this.packCoordinates(specialCell.position.x, specialCell.position.y,
                                                             specialCell.position.z);
            specialCell.position.shape = 'S';
            specialCell.position.value = specialCell.value;
            specialCell.position.color = 'rgba(255,255,0,0.5)';
            specialCell.position.height = 0;
            IsometricMap.map.push(specialCell.position);
        }

        for (const spt0 of IsometricMap.info.startingPointTeam0) {
            // this.drawCross(-spt0.y, spt0.x, spt0.z, 'pink')
            spt0.hash = this.packCoordinates(spt0.x, spt0.y, spt0.z + this.specialCaseHashBais);
            spt0.shape = 'C'
            spt0.color = 'rgba(173,180,255,0.5)'
            spt0.height = 0
            IsometricMap.map.push(spt0)
        }

        for (const spt0 of IsometricMap.info.startingPointTeam1) {
            // this.drawCross(-spt0.y, spt0.x, spt0.z, 'pink')
            spt0.hash = this.packCoordinates(spt0.x, spt0.y, spt0.z + this.specialCaseHashBais);
            spt0.shape = 'C'
            spt0.color = 'rgba(255,213,173,0.5)'
            spt0.height = 0
            IsometricMap.map.push(spt0)
        }

        for (const cp of IsometricMap.info.coachPos) {
            // this.drawCross(-cp.y, cp.x, cp.z, 'magenta')
            cp.hash = this.packCoordinates(cp.x, cp.y, cp.z + this.specialCaseHashBais);
            cp.height = 0
            cp.shape = 'C'
            cp.color = 'rgba(0,255,255,0.77)'
            IsometricMap.map.push(cp)
        }

        IsometricMap.map.sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0))
        IsometricMap.tplg.sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0))
        const mapWidth = this.maxX - this.minX
        const mapHeight = this.maxY - this.minY
        this.Xtiles = mapWidth;
        this.Ytiles = mapHeight;

        console.log('mapHeight: ', mapHeight, 'mapWidth: ', mapWidth)
        console.log('x: [', this.minX, this.maxX, ']')
        console.log('y: [', this.minY, this.maxY, ']')

        this.originX = width / 2 - this.Xtiles * this.tileColumnOffset / 2;
        this.originY = height / 2 - this.Ytiles * this.tileRowOffset / 2;
        console.log('originX: ', this.originX, 'originY: ', this.originY)
    },

    redrawTiles: function () {
        this.context.canvas.width = this.context.canvas.width;

        const numberOfCells = IsometricMap.map.length
        for (let i = 0; i < numberOfCells; i++) {
            let cell = IsometricMap.map[i];
            if (cell.shape === 'D') {
                this.drawDiamond(-cell.y, cell.x, cell.z - cell.height, cell.color, cell.height)
            } else if (cell.shape === 'C') {
                this.drawCross(-cell.y, cell.x, cell.z - cell.height, cell.color, cell.height)
            } else if (cell.shape === 'S') {
                if (this.drawSpecialCellsImg) {
                    const offX = (-cell.y) * this.tileColumnOffset / 2 + cell.x * this.tileColumnOffset / 2 + this.originX;
                    const offY = cell.x * this.tileRowOffset / 2 - (-cell.y) * this.tileRowOffset / 2 + this.originY;
                    const cellImg = CELL_OFFSET[cell.value] * this.tileColumnOffset
                    this.context.drawImage(this.specialCellsImg, cellImg, 0, this.tileColumnOffset, this.tileRowOffset, offX, offY, this.tileColumnOffset, this.tileRowOffset);
                } else {
                    this.drawCross(-cell.y, cell.x, cell.z - cell.height, cell.color, cell.height)
                }
            }
        }

        this.drawBorder(-this.minY + this.y * 18, this.minX + this.x * 18, 0, 'yellow', 18)

        if (this.showCoordinates && this.isCursorOnMap() && this.selected) {
            const selected = this.selected
            if (selected.z < 0) {
                this.drawBorder(-selected.y, selected.x, 0, 'yellow');
            }
            this.drawBorder(-selected.y, selected.x, selected.z, 'yellow');
            if (selected.z > 0) {
                this.drawBorder(-selected.y, selected.x, 0, 'yellow');
            }
            this.context.fillStyle = 'yellow';
            this.context.font = '14pt Arial';
            this.context.fillText(
                `[${this.selectedTileX}, ${this.selectedTileY}] \n{x: ${selected.x},\ny: ${selected.y},\nz: ${selected.z}\n}`,
                20,
                30)
        }
    },
    
    changeMap(id) {
        return fetch(`./map/${id}.json`)
            .then(response => response.json())
            .then(mapData => {
                document.getElementById('preview').src = `https://raw.githubusercontent.com/Jydett/ArenaMaps/main/webp/${id}.png.webp`;
                this.x = 0;
                this.originX = 0;
                this.originY = 0;
                this.y = 0;
                this.id = id;
                IsometricMap.map = mapData.cells["0"];
                this.loadMapDataInCanvas();
                this.redrawTiles();
            });
    },

    importData: function () {
        let id = this.id;
        for (const fightInfo of FIGHT_MAP_INFO) {
            if (fightInfo.id === id) {
                IsometricMap.info = fightInfo;
                return;
            }
        }
    },

    isCursorOnMap: function () {
        return (this.selectedTileX >= this.minX && this.selectedTileX <= this.maxX &&
            this.selectedTileY >= this.minX && this.selectedTileY <= this.maxY);
    },

    drawCross: function (Xi, Yi, Zi, color) {
        if (Zi === -32768) {
            color = '#555555'
            Zi = 0
            if (this.hideOffMap) {
                return
            }
        }
        const offX = Xi * this.tileColumnOffset / 2 + Yi * this.tileColumnOffset / 2 + this.originX;
        const offY = Yi * this.tileRowOffset / 2 - Xi * this.tileRowOffset / 2 + this.originY;

        this.context.strokeStyle = 'grey';
        this.context.fillStyle = color;
        this.context.lineWidth = 1;
        this.context.beginPath();        
        this.context.moveTo(offX + (Zi !== 0 ? this.altitudePadding : 0),
                                                             offY + this.tileRowOffset / 2 + Zi * this.ZOffset);
        this.context.lineTo(offX + this.tileColumnOffset - (Zi !== 0 ? this.altitudePadding : 0),
                            offY + this.tileRowOffset / 2 + Zi * this.ZOffset);
        this.context.lineTo(offX + this.tileColumnOffset / 2,
                            offY + Zi * this.ZOffset + (Zi !== 0 ? this.altitudePadding / 2 : 0));
        this.context.lineTo(offX + this.tileColumnOffset / 2,
                            offY + this.tileRowOffset + Zi * this.ZOffset - (Zi !== 0 ? this.altitudePadding / 2 : 0));
        this.context.closePath();
        this.context.fill();
        this.context.stroke();
    },

    drawBorder: function (Xi, Yi, Zi, color, scale = 1) {
        if (Zi === -32768) {
            color = '#555555'
            Zi = 0
            if (this.hideOffMap) {
                return
            }
        }

        if (scale > 1) {
            const f = ((scale - 1) * 0.5);
            Xi = Xi - f
            Yi = Yi - f
        }

        const offX = Xi * this.tileColumnOffset / 2 + Yi * this.tileColumnOffset / 2 + this.originX;
        const offY = Yi * this.tileRowOffset / 2 - Xi * this.tileRowOffset / 2 + this.originY;

        const colOffset = (this.tileColumnOffset * scale)
        const rowOffset = (this.tileRowOffset * scale)

        this.context.strokeStyle = color;
        this.context.lineWidth = 2;
        this.context.beginPath();
        this.context.moveTo(offX, offY + rowOffset / 2 + Zi * this.ZOffset);
        this.context.lineTo(offX + colOffset / 2, offY + Zi * this.ZOffset);
        this.context.lineTo(offX + colOffset, offY + rowOffset / 2 + Zi * this.ZOffset);
        this.context.lineTo(offX + colOffset / 2, offY + rowOffset + Zi * this.ZOffset);
        this.context.closePath();
        this.context.stroke();
    },

    drawDiamond: function (Xi, Yi, Zi, color, height) {
        if (Zi === -32768) {
            color = '#555555'
            Zi = 0
            if (this.hideOffMap) {
                return
            }
        }
        const offX = Xi * this.tileColumnOffset / 2 + Yi * this.tileColumnOffset / 2 + this.originX;
        const offY = Yi * this.tileRowOffset / 2 - Xi * this.tileRowOffset / 2 + this.originY;

        this.context.strokeStyle = 'grey';
        this.context.fillStyle = color;
        this.context.lineWidth = 1;
        this.context.beginPath();
        this.context.moveTo(offX + (Zi !== 0 ? this.altitudePadding : 0),
                            offY + this.tileRowOffset / 2 + Zi * this.ZOffset);
        this.context.lineTo(offX + this.tileColumnOffset / 2,
                            offY + Zi * this.ZOffset + (Zi !== 0 ? this.altitudePadding / 2 : 0));
        this.context.lineTo(offX + this.tileColumnOffset - (Zi !== 0 ? this.altitudePadding : 0),
                            offY + this.tileRowOffset / 2 + Zi * this.ZOffset);
        this.context.lineTo(offX + this.tileColumnOffset / 2,
                            offY + this.tileRowOffset + Zi * this.ZOffset - (Zi !== 0 ? this.altitudePadding / 2 : 0));
        this.context.closePath();
        this.context.fill();
        this.context.stroke();

        if (Zi !== 0 && this.ZOffset !== 0) {
            this.drawLine(offX + this.tileRowOffset,
                                  offY + this.tileColumnOffset / 4,
                          offX + this.tileRowOffset,
                          offY + this.tileRowOffset + Zi * this.ZOffset - (Zi !== 0 ? this.altitudePadding / 2 : 0)
                , 'magenta')

        }
        

        this.context.fillStyle = 'black'; 
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';
        this.context.fillText(Zi, offX + this.tileRowOffset,
                                offY + this.tileColumnOffset / 4 + Zi * this.ZOffset)
        

        if (height > 0) {
            // this.context.strokeStyle = 'green';
            // this.context.fillStyle = 'green';
            // this.context.beginPath();
            // this.context.moveTo(offX, offY + this.tileRowOffset / 2 + Zi * this.ZOffset);
            // this.context.lineTo(offX, offY + this.tileRowOffset / 2 + (Zi - height) * this.ZOffset);
            // this.context.lineTo(offX + this.tileColumnOffset / 2, offY + this.tileRowOffset + (Zi - height) * this.ZOffset);
            // this.context.lineTo(offX + this.tileColumnOffset, offY + this.tileRowOffset / 2 + (Zi - height) * this.ZOffset);
            // this.context.lineTo(offX + this.tileColumnOffset / 2, offY + (Zi - height) * this.ZOffset);
            // this.context.lineTo(offX, offY + this.tileRowOffset / 2 + (Zi - height) * this.ZOffset);
            // this.context.closePath();
            // this.context.fill();
            // this.context.stroke();
        }
    },

    drawLine: function (x1, y1, x2, y2, color) {
        color = typeof color !== 'undefined' ? color : 'white';
        this.context.strokeStyle = color;
        this.context.beginPath();
        this.context.lineWidth = 1;
        this.context.moveTo(x1, y1);
        this.context.lineTo(x2, y2);
        this.context.stroke();
    },

    packCoordinates: function (x, y, zOrder) {
        const MASK = BigInt(0x3FFF);
        const SHIFT_34 = BigInt(34);
        const SHIFT_19 = BigInt(19);
        const SHIFT_6 = BigInt(6);

        const yBigInt = BigInt(y) + BigInt(8192);
        const xBigInt = BigInt(x) + BigInt(8192);

        return ((yBigInt & MASK) << SHIFT_34) |
            ((xBigInt & MASK) << SHIFT_19) |
            ((BigInt(zOrder) & MASK) << SHIFT_6) |
            BigInt(0);
    }
};
