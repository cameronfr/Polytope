import RandGenerator from "random-seed"

//------------------------------ APPARATUS 3 ------------------------------
// Author: kgolid -- p5ycho (https://github.com/kgolid/p5ycho) MIT License

class ApparatusGenerator {

  constructor() {
    this.canvas = document.createElement("canvas")
    this.canvas.style.cssText = "position: absolute, top:0, left: 0, z-index: -1, height: 10px, width: 10px"
    this.canvas.width = 250
    this.canvas.height = 250
    this.ctx = this.canvas.getContext("2d")
    this.renderQueue = []

    var tick = timestamp => {
      if (this.renderQueue.length > 0) {
        var {targetCanvas, seed} = this.renderQueue.pop()
        this.generate(seed)
        var targetCtx = targetCanvas.getContext("2d")
        targetCtx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height, 0, 0, targetCanvas.width, targetCanvas.height) //copy with possible downscaling
      }
      this.animationFrameRequestID = window.requestAnimationFrame(tick)
    }
    this.animationFrameRequestID = window.requestAnimationFrame(tick)
  }

  destroy() {
    window.cancelAnimationFrame(this.animationFrameRequestID)
  }

  generate(seed) {
    this.ctx.fillStyle = "#eeeee8"
    this.ctx.fillRect(0, 0, this.canvas.height, this.canvas.width)

    var colors = [
      "rgb(142, 192, 124)",
      "rgb(250, 189, 47)",
      "rgb(251, 71, 44)",
      "rgb(211, 134, 147)",
      "rgb(49, 69, 80)",
    ]

    var xdim = 18
    var ydim = 18
    var radius = 8
    var size = 10

    var chance_start = 1
    var chance_extend = 0.88
    var chance_vertical = 0.5
    var builder = new BlockBuilder(xdim, ydim, radius, chance_start, chance_extend, chance_vertical, colors, seed)

    // offsets
    this.ox = 25
    this.oy = 30

    var grid = builder.generate()
    this.display({lineWidth: 6, size, grid})
    this.display({lineWidth: 2, size, grid})
  }

  display(options) {
    var {grid, lineWidth, size} = options
    for (var i = 0; i < grid.length; i++) {
      for (var j = 0; j < grid[i].length; j++) {
        if (grid[i][j].in && grid[i][j].col != null) {
          this.ctx.fillStyle= grid[i][j].col
          this.makeFillRect(j * size, i * size, size, size)
        }
        this.ctx.strokeStyle = "black"
        this.ctx.lineWidth = lineWidth
        this.ctx.lineCap = "round"
        if (grid[i][j].h) {this.makeLine(j * size, i * size, (j + 1) * size, i * size)}
        if (grid[i][j].v) {this.makeLine(j * size, i * size, j * size, (i + 1) * size)}
      }
    }
  }

  generateAndCopy(options) {
    this.renderQueue.unshift(options)
  }

  makeFillRect(x1, y1, width, height) {
    this.ctx.fillRect(this.ox + x1, this.oy + y1, width, height)
  }

  makeLine(x1, y1, x2, y2) {
    this.ctx.beginPath();
    this.ctx.moveTo(this.ox + x1, this.oy + y1);
    this.ctx.lineTo(this.ox + x2, this.oy + y2);
    // if ctx.closePath, end caps don't get added
    this.ctx.stroke();
  }
}

class BlockBuilder {
  constructor(x, y, r, c_new, c_ext, c_vert, cols, seed) {
    this.grid_dim_x = x;
    this.grid_dim_y = y;
    this.radius = r;
    this.chance_new = c_new;
    this.chance_extend = c_ext;
    this.chance_vertical = c_vert;
    this.colors = cols;
    this.random = RandGenerator.create(seed).random
  }

  generate() {
    let grid = new Array(this.grid_dim_y + 1);
    for (var i = 0; i < grid.length; i++) {
      grid[i] = new Array(this.grid_dim_x + 1);
      for (var j = 0; j < grid[i].length; j++) {
        if (i == 0 || j == 0) grid[i][j] = { h: false, v: false, in: false, col: null };
        else grid[i][j] = this.next_block(j, i, grid[i][j - 1], grid[i - 1][j]);
      }
    }

    return grid;
  }

  next_block(x, y, left, top) {

    // --- Block sets ----

    var block_set_1 = (x, y) => {
      if (start_new_from_blank(x, y)) return new_block();
      return { v: false, h: false, in: false, col: null };
    }

    var block_set_2 = (x, y) => {
      if (start_new_from_blank(x, y)) return new_block();
      return { v: true, h: false, in: false, col: null };
    }

    var block_set_3 = (x, y) => {
      if (extend(x, y)) return { v: false, h: true, in: true, col: left.col };
      return block_set_2(x, y);
    }

    var block_set_4 = (x, y) => {
      if (start_new_from_blank(x, y)) return new_block();
      return { v: false, h: true, in: false, col: null };
    }

    var block_set_5 = (x, y) => {
      if (extend(x, y)) return { v: true, h: false, in: true, col: top.col };
      return block_set_4(x, y);
    }

    var block_set_6 = () => {
      return { v: false, h: false, in: true, col: left.col };
    }

    var block_set_7 = (x, y) => {
      if (extend(x, y)) return { v: false, h: true, in: true, col: left.col };
      if (start_new(x, y)) return new_block();
      return { v: true, h: true, in: false, col: null };
    }

    var block_set_8 = (x, y) => {
      if (extend(x, y)) return { v: true, h: false, in: true, col: top.col };
      if (start_new(x, y)) return new_block();
      return { v: true, h: true, in: false, col: null };
    }

    var block_set_9 = (x, y) => {
      if (extend(x, y)) {
        if (vertical_dir()) return { v: true, h: false, in: true, col: top.col };
        return { v: false, h: true, in: true, col: left.col };
      }
      if (start_new(x, y)) return new_block();
      return { v: true, h: true, in: false, col: null };
    }

    // ---- Blocks ----

    var new_block = () => {
      return { v: true, h: true, in: true, col: get_random(this.colors) };
    }

    // ---- Decisions ----

    var start_new_from_blank = (x, y) => {
      if (!active_position(x, y, false)) return false;
      return this.random() <= this.chance_new / 10;
    }

    var start_new = (x, y) => {
      if (!active_position(x, y, false)) return false;
      return this.random() <= this.chance_new;
    }

    var extend = (x, y) => {
      if (!active_position(x, y, true)) return false;
      return this.random() <= this.chance_extend;
    }

    var g_start_new = (x, y) => {
      let dist_from_centre = get_diagonal(x, y, this.grid_dim_x / 2, this.grid_dim_y / 2);
      return this.random() * this.radius > dist_from_centre;
    }

    var g_extend = (x, y) => {
      let dist_from_centre = get_diagonal(x, y, this.grid_dim_x / 2, this.grid_dim_y / 2);
      return Math.sqrt(this.random()) * this.radius * 2 > dist_from_centre;
    }

    var vertical_dir = () => {
      return this.random() <= this.chance_vertical;
    }

    var active_position = (x, y, fuzzy) => {
      let fuzziness = fuzzy ? 1 + this.random() * 0.3 : 1 - this.random() * 0.3;
      return get_diagonal(x, y, this.grid_dim_x / 2, this.grid_dim_y / 2) < this.radius * 1;
    }

    // --- Utils ----

    var get_diagonal = (p1x, p1y, p2x, p2y) => {
      return Math.sqrt(Math.pow(dist(p1x, p2x), 2) + Math.pow(dist(p1y, p2y), 2));
    }

    var dist = (n, m) => {
      return Math.max(n - m, m - n);
    }

    var get_random = (array) => {
      return array[Math.floor(this.random() * array.length)];
    }

    // Do stuff

    if (!left.in && !top.in) {
      return block_set_1(x, y);
    }

    if (left.in && !top.in) {
      if (left.h) return block_set_3(x, y);
      return block_set_2(x, y);
    }

    if (!left.in && top.in) {
      if (top.v) return block_set_5(x, y);
      return block_set_4(x, y);
    }

    if (left.in && top.in) {
      if (!left.h && !top.v) return block_set_6();
      if (left.h && !top.v) return block_set_7(x, y);
      if (!left.h && top.v) return block_set_8(x, y);
      return block_set_9(x, y);
    }
  }
}

export {ApparatusGenerator}

//------------------------------  ------------------------------
