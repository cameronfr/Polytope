// Exporter by quasimondo
// https://codepen.io/quasimondo/pen/QjqZvV?editors=1010

function VoxExporter(X, Y, Z) {
  this.X = X;
  this.Y = Y;
  this.Z = Z;
  this.vcount = 0
  this.voxels = [];
  this.palette = [];

  for (var i = 256; --i > -1;) {
    this.palette.push(0xff000000 | i | (i << 8) | (i << 16));
  }

  this.setVoxel = function(x, y, z, i) {
    i |= 0;
    x |= 0;
    y |= 0;
    z |= 0;

    if (i >= 0 && i < 256 && x >= 0 && y >= 0 && z >= 0 && x < this.X && z < this.Y && z < this.Z) {
      var key = x + "_" + y + "_" + z
      if (i > 0) {
        if (!this.voxels[key]) this.vcount++;
        this.voxels[key] = i;
      } else {
        if (this.voxels[key]) this.vcount--;
        delete this.voxels[key];
      }
    }
  }

  this.appendString = function(data, str) {
    for (var i = 0, j = str.length; i < j; ++i) {
      data.push(str.charCodeAt(i));
    }
  }

  this.appendUInt32 = function(data, n) {
    data.push(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
  }

  this.appendRGBA = function(data, n) {
    data.push((n >>> 16) & 0xff,(n >>> 8) & 0xff, n & 0xff, (n >>> 24) & 0xff);
  }

  this.appendVoxel = function(data, key) {
    var v = key.split("_");
    data.push(v[0], v[1], v[2], this.voxels[key]);
  }

  this.export = function(filename) {
    var data = [];
    this.appendString(data, "VOX ");
    this.appendUInt32(data, 150);
    this.appendString(data, "MAIN");
    this.appendUInt32(data, 0);
    this.appendUInt32(data, this.vcount * 4 + 0x434);

    this.appendString(data, "SIZE");
    this.appendUInt32(data, 12);
    this.appendUInt32(data, 0);
    this.appendUInt32(data, this.X);
    this.appendUInt32(data, this.Y);
    this.appendUInt32(data, this.Z);
    this.appendString(data, "XYZI");
    this.appendUInt32(data, 4 + this.vcount * 4);
    this.appendUInt32(data, 0);
    this.appendUInt32(data, this.vcount);
    for (var key in this.voxels) {
      this.appendVoxel(data, key);
    }
    this.appendString(data, "RGBA");
    this.appendUInt32(data, 0x400);
    this.appendUInt32(data, 0);
    for (var i = 0; i < 256; i++) {
        this.appendRGBA(data, this.palette[i]);
    }
    this.saveByteArray([new Uint8Array(data)], filename)
    return
  }

  this.saveByteArray = (function() {
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    return function(data, name) {
      var blob = new Blob(data, {
          type: "octet/stream"
        }),
        url = window.URL.createObjectURL(blob);
      a.href = url;
      a.download = name;
      a.click();
      window.URL.revokeObjectURL(url);
    };
  }());
}

export default VoxExporter
