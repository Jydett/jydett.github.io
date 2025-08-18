class ANMHeader {
    versionNumber;
    unusedShort;
    frameRate;

    isUseLocalIndex() {
        return (this.versionNumber & 2) !== 0;
    }
}

class ANMIndex {
    flags;
    scale = 1.0;
    renderRadius = 1.0;
    
    hasScale() {
        return (this.flags & 1) !== 0;
    }

    hasExtension() {
        return (this.flags & 2) !== 0;
    }

    hasRenderRadius() {
        return (this.flags & 8) !== 0;
    }

    hasHiddingPart() {
        return (this.flags & 4) !== 0;
    }

    useFlip() {
        return (this.flags & 16) === 0;
    }

    usePerfectHitTest() {
        return (this.flags & 32) === 32;
    }

    canHidePart() {
        return (this.flags & 64) !== 0;
    }

    isExtended() {
        return (this.flags & 128) !== 0;
    }
}

class AnmImport {
    id;
    name;
    nameCRC;
}

class AnmAnimationFileRecord {
    name;
    nameCRC;
    CRC;
    fileIndex;
}

class AnmTexture {
    numTexture;
    textureName;
    baseCRC;
}

class AnmShape {
    id;
    textureIndex;
    top;
    left;
    bottom;
    right;
    width;
    height;
    offsetX;
    offsetY;
}

class AnmSpriteDefinition {
    id;
    explainedFlags;
    name;
    frames = [];
    nameCRC;
    baseCRC;
    shape1 = [];//TODO name
    shape2 = [];//TODO name
    _flags;


    set flags(value) {
        this._flags = value;
        this.explainedFlags = {
            customColorIndex: this._flags & 0b0011_1111,
            hasName: (this._flags & 0b0100_0000) != 0b0,
            isLoop: (this._flags & 0b1000_0000) == 0b0,
        }
    }
}

class AnmFrame {
    sprites = [];
    actions = [];
}

class  ANMFile {
    header = new ANMHeader();
    index = new ANMIndex();
    animationFileRecords = [];
    texture = new AnmTexture();
    shapes = [];
    spriteDefinitions = [];
    numActions;
    strings = [];
    imports = [];
}

class DefaultAnmShape {
    id;
    dataDescriptor = 0;

    load(dataView) {
        //noop
    }
    write(out) {
        //noop
    }
}

class AnmShapeCT {
    id;
    dataDescriptor = 82;
    translationX;
    translationY;

    load(dataView) {
        this.translationX = dataView.$getShort();
        this.translationY = dataView.$getShort();
    }
    write(out) {
        out.$writeShort(this.translationX);
        out.$writeShort(this.translationY);
    }


}

class FakeView {
    $index = 0;
    $writeByte() { this.$index = this.$index + 1; }
    $writeShort() { this.$index = this.$index + 2; }
    $writeInt() { this.$index = this.$index + 4; }
    $writeFloat() { this.$index = this.$index + 4; }
    $writeString(str) { this.$index = this.$index + str.length + 1; }
}

function ANMFromJSONObj(json) {
    Object.setPrototypeOf(json, ANMFile.prototype)
    Object.setPrototypeOf(json.header, ANMHeader.prototype)
    Object.setPrototypeOf(json.index, ANMIndex.prototype)
    if (json.texture) Object.setPrototypeOf(json.texture, AnmTexture.prototype)
    for (let spriteDefinition of json.spriteDefinitions) {
        Object.setPrototypeOf(spriteDefinition, AnmSpriteDefinition.prototype)
        spriteDefinition.flags = spriteDefinition._flags; //refresh explained flags
        for (let shape1Element of spriteDefinition.shape1) {
            throw "not implemented"
        }
        for (let shape1Element of spriteDefinition.shape2) {
            throw "not implemented"
        }
        for (let frame of spriteDefinition.frames) {
            Object.setPrototypeOf(frame, AnmFrame.prototype)
            for (let sprite of frame.sprites) {
                let proto;
                switch (sprite.dataDescriptor) {
                    case 0: proto = DefaultAnmShape.prototype; break;
                    default: throw "not implemented"
                }
                Object.setPrototypeOf(sprite, proto)
            }
        }
    }

    for (let shape of json.shapes) {
        Object.setPrototypeOf(shape, AnmShape.prototype)
    }

    for (let animationFileRecords of json.animationFileRecords) {
        Object.setPrototypeOf(animationFileRecords, AnmAnimationFileRecord.prototype)
    }

    return json;
}

function createShape(dataView) {
    let id = dataView.$getShort();
    let dataDescriptor = dataView.$getByte();
    let res;
    switch (dataDescriptor) {
        case 0: {
            res = new DefaultAnmShape();
            break
        }
        case 82: {
            res = new AnmShapeCT();
            break
        }
        default: throw "not implemented"
    }

    res.load(dataView);
    res.id = id;
    return res;
}

function writeANM_(anm, out) {
    //header
    out.$writeByte(anm.header.versionNumber)
    out.$writeShort(anm.header.unusedShort)
    out.$writeByte(anm.header.frameRate)

    //index
    out.$writeByte(anm.index.flags);
    if (anm.index.hasScale()) {
        out.$writeFloat(anm.index.scale);
    }
    if (anm.index.hasRenderRadius()) {
        out.$writeFloat(anm.index.renderRadius);
    }
    if (anm.index.hasExtension()) {
        throw "not implemented"
    }

    if (anm.index.hasHiddingPart()) {
        throw "not implemented"
    }

    if (anm.index.canHidePart()) {
        throw "not implemented"
    }

    if (anm.index.isExtended()) {
        throw "not implemented"
    }

    out.$writeShort(anm.animationFileRecords.length)
    for (let animationFileRecord of anm.animationFileRecords) {
        out.$writeString(animationFileRecord.name)
        out.$writeInt(animationFileRecord.nameCRC)
        out.$writeInt(animationFileRecord.CRC)
        out.$writeShort(animationFileRecord.fileIndex)
    }

    //texture
    out.$writeShort(anm.texture.numTexture);
    if (anm.texture.numTexture === 1) {
        out.$writeString(anm.texture.textureName);
        out.$writeInt(anm.texture.baseCRC);
    }

    //shapes
    out.$writeShort(anm.shapes.length);
    for (let shape of anm.shapes) {
        out.$writeShort(shape.id);
        out.$writeShort(shape.textureIndex);

        out.$writeShort((shape.top * 65535.0) & 0xffff);
        out.$writeShort((shape.left * 65535.0) & 0xffff);
        out.$writeShort((shape.bottom * 65535.0) & 0xffff);
        out.$writeShort((shape.right * 65535.0) & 0xffff);

        out.$writeShort(shape.width);
        out.$writeShort(shape.height);
        out.$writeFloat(shape.offsetX);
        out.$writeFloat(shape.offsetY);
    }


    //frames
    out.$writeShort(anm.spriteDefinitions.length);
    for (let spriteDefinition of anm.spriteDefinitions) {
        out.$writeShort(spriteDefinition.id);
        out.$writeByte(spriteDefinition._flags);
        if (spriteDefinition.explainedFlags.hasName) {
            out.$writeString(spriteDefinition.name);
        }
        out.$writeInt(spriteDefinition.nameCRC);
        out.$writeInt(spriteDefinition.baseCRC);
        out.$writeByte(spriteDefinition.shape1.length);
        for (let shape1Element of spriteDefinition.shape1) {
            throw "not implemented"
        }
        out.$writeByte(spriteDefinition.shape2.length);
        for (let shape1Element of spriteDefinition.shape2) {
            throw "not implemented"
        }
        out.$writeShort(spriteDefinition.initialSize);
        for (let frame of spriteDefinition.frames) {

            out.$writeShort(frame.sprites.length);
            for (let sprite of frame.sprites) {
                out.$writeShort(sprite.id);
                out.$writeByte(sprite.dataDescriptor);
                sprite.write(out);
            }

            out.$writeByte(frame.actions.length);
            for (let action of frame.actions) {
                throw "not implemented"
            }
            out.$writeShort(frame.skipped);
        }

    }

    //imports
    out.$writeShort(anm.imports.length);
    for (let anmImport of anm.imports) {
        out.$writeInt(anmImport.id);
        out.$writeString(anmImport.name);
        out.$writeInt(anmImport.nameCRC);
    }

    out.$writeShort(anm.strings.length);
    for (let str of anm.strings) {
        out.$writeString(str)
    }

    out.$writeShort(anm.numActions)
}

function writeANM(anm) {
    if (! anm) throw "Param anm needed !"
    let fakeView = new FakeView();
    writeANM_(anm, fakeView)
	let out = new DataView(new ArrayBuffer(fakeView.$index))
    writeANM_(anm, out)
    return out;
}

function loadANM(readerEvent) {
    let dataView = new DataView(readerEvent.target.result);
    let res = new ANMFile();

    //header
    res.header.versionNumber = dataView.$getByte()
    res.header.unusedShort = dataView.$getShort();
    res.header.frameRate = dataView.$getByte();

    console.log("uselocal", res.header.isUseLocalIndex())
    //index
    res.index.flags = dataView.$getByte();
    if (res.index.hasScale()) {
        res.index.scale = dataView.$getFloat();
    }
    if (res.index.hasRenderRadius()) {
        res.index.renderRadius = dataView.$getFloat();
    }

    if (res.index.hasExtension()) {
        let numberOfFiles = dataView.$getShort();
        res.fileNames = [];
        for (let i = 0; i < numberOfFiles; i++) {
            res.fileNames.push(dataView.$getString());
        }
    }

    if (res.index.hasHiddingPart()) {
        let numberOfHidingParts = dataView.$getByte();
        res.hasHidePartItem = [];
        for (let i = 0; i < numberOfHidingParts; i++) {
            res.hasHidePartItem.push({crcKey: dataView.$getInt(), crcToHide: dataView.$getInt()})
        }
    }

    if (res.index.canHidePart()) {
        let numAnimationFileRecords = dataView.$getByte();
        res.canHidePartItem = [];
        for (let i = 0; i < numAnimationFileRecords; i++) {
            res.canHidePartItem.push({itemName: dataView.$getString(), crcKey: dataView.$getInt()})
        }
    }

    if (res.index.isExtended()) {
        throw "not implemented"
    }

    let fileRecordsNumber = dataView.$getShort();

    for (let i = 0; i < fileRecordsNumber; i++) {
        let anmAnimationFileRecord = new AnmAnimationFileRecord();
        anmAnimationFileRecord.name = dataView.$getString();
        anmAnimationFileRecord.nameCRC = dataView.$getInt();
        anmAnimationFileRecord.CRC = dataView.$getInt();
        anmAnimationFileRecord.fileIndex = dataView.$getShort()
        res.animationFileRecords.push(anmAnimationFileRecord);
    }

    //texture
    res.texture.numTexture = dataView.$getShort();
    if (res.texture.numTexture === 1) {
        res.texture.textureName = dataView.$getString();
        res.texture.baseCRC = dataView.$getInt();
    }

    //shapes
    let shapesNumber = dataView.$getShort();
    for (let i = 0; i < shapesNumber; i++) {
        let anmShape = new AnmShape();

        anmShape.id = dataView.$getShort();
        anmShape.textureIndex = dataView.$getShort();
        anmShape.top = (dataView.$getShort() & 0xffff) / 65535.0;//TODO précision
        let left = dataView.$getShort();
        anmShape.bottom = (dataView.$getShort() & 0xffff) / 65535.0;
        anmShape.right = (dataView.$getShort() & 0xffff) / 65535.0;
        anmShape.width = dataView.$getShort();
        anmShape.height = dataView.$getShort();
        anmShape.offsetX = dataView.$getFloat();
        anmShape.offsetY = dataView.$getFloat();

        res.shapes.push(anmShape);
    }

    //frames
    let framesNumber = dataView.$getShort();
    for (let i = 0; i < framesNumber; i++) {
        let anmSpriteDefinition = new AnmSpriteDefinition();

        anmSpriteDefinition.id = dataView.$getShort();
        anmSpriteDefinition.flags = dataView.$getByte();
        if (anmSpriteDefinition.explainedFlags.hasName) {
            anmSpriteDefinition.name = dataView.$getString();
        }
        anmSpriteDefinition.nameCRC = dataView.$getInt();
        anmSpriteDefinition.baseCRC = dataView.$getInt();
        let shape1Size = dataView.$getByte();
        for (let j = 0; j < shape1Size; j++) {
            throw "not implemented"
        }
        let shape2Size = dataView.$getByte();
        for (let j = 0; j < shape2Size; j++) {
            throw "not implemented"
        }
        let frameSize = dataView.$getShort();
        anmSpriteDefinition.initialSize = frameSize;
        for (let j = 0; j < frameSize; j++) {
            let anmFrame = new AnmFrame();

            {
                let numSprites = dataView.$getShort();
                for (let k = 0; k < numSprites; k++) {
                    anmFrame.sprites.push(createShape(dataView))
                }

                //load actions
                let numActions = dataView.$getByte();
                for (let k = 0; k < numActions; k++) {
                    throw "not implemented"
                }
            }
            anmFrame.skipped = dataView.$getShort();
            j = j + anmFrame.skipped;

            anmSpriteDefinition.frames.push(anmFrame);
        }

        res.spriteDefinitions.push(anmSpriteDefinition);
    }



    //imports
    let importsNumber = dataView.$getShort();

    for (let i = 0; i < importsNumber; i++) {
        let anmImport = new AnmImport();
        anmImport.id = dataView.$getInt();
        anmImport.name = dataView.$getString();
        anmImport.nameCRC = dataView.$getInt();
        res.imports.push(anmImport);
    }

    let strSize = dataView.$getShort();
    for (let i = 0; i < strSize; i++) {
        res.strings.push(dataView.$getString())
    }

    res.numActions = dataView.$getShort();

    if (! dataView.$noBytesLeft()) throw "File not red entirely !"

    return res;
}
