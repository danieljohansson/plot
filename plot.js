(function () {

// extend(target, source_1, ... , source_n);
var extend = function (target) {
	var sources = [].slice.call(arguments, 1);
	sources.forEach(function (source) {
		Object.getOwnPropertyNames(source).forEach(function (propName) {
			Object.defineProperty(target, propName,
				Object.getOwnPropertyDescriptor(source, propName));
		});
	});
	return target;
};

//
//  Line
//
var Line = function (plot, x, y, options) {
	this.plot = plot;
	this._options = options || {};
	this._setData(x, y);
};

var onlyNumbers = function (x) {
	var i, len = x.length;
	for (i = 0; i < len; i++) {
		// Set non numbers and NaN to null
		if (typeof x[i] !== 'number' || x[i] !== x[i]) {
			x[i] = null;
			console.warn('Non numeric values in data set.');
		}
	}
	return x;
};

Line.prototype._setData = function (x, y) {
	if (!Array.isArray(x) || !Array.isArray(y)) {
		throw new TypeError('Parameters "x" and "y" must be arrays.');
	}
	if (x.length !== y.length) {
		throw new Error('Arrays "x" and "y" must be of equal length.');
	}
	if (x.length > 1e4) {
		x.splice(1e4, x.length);
		y.splice(1e4, y.length);
		console.warn('Too many data points. First 10000 plotted.');
	}

	this.x = onlyNumbers(x);
	this.y = onlyNumbers(y);
};

Line.prototype.setData = function (x, y) {
	this._setData(x, y);
	this.plot.render();
};

Line.prototype.options = function (options) {
	extend(this._options, options);
	this.plot.render();
};

Line.prototype.remove = function () {
	this.dead = true;
	this.plot.lineRemove();
};


//
//  Plot
//
var colors = [
	'royalblue',
	'tomato',
	'forestgreen',
	'orange',
	'darkmagenta',
	'lightseagreen',
	'chocolate',
	'midnightblue',
	'red',
	'darkorchid'
];

var xAxisHeight = 35;
var yAxisWidth = 50;

var markerAt = {
	'o': function (x, y, size) {
		this.ctx.moveTo(x + size, y);
		this.ctx.arc(x, y, size, 0, Math.PI*2, true);
		this.ctx.moveTo(x, y);
	},

	'+': function (x, y, size) {
		this.ctx.moveTo(Math.ceil(x) - size - 1, Math.ceil(y) + 0.5);
		this.ctx.lineTo(Math.ceil(x) + size, Math.ceil(y) + 0.5);
		this.ctx.moveTo(Math.ceil(x) - 0.5, Math.ceil(y) - size);
		this.ctx.lineTo(Math.ceil(x) - 0.5, Math.ceil(y) + size + 1);
		this.ctx.moveTo(x, y);
	},

	'x': function (x, y, size) {
		this.ctx.moveTo(Math.round(x) - size + 1, Math.round(y) - size + 1);
		this.ctx.lineTo(Math.round(x) + size - 1, Math.round(y) + size - 1);
		this.ctx.moveTo(Math.round(x) - size + 1, Math.round(y) + size - 1);
		this.ctx.lineTo(Math.round(x) + size - 1, Math.round(y) - size + 1);
		this.ctx.moveTo(x, y);
	},

	'box': function (x, y, size) {
		this.ctx.rect(Math.round(x) + 0.5 - size, Math.round(y) + 0.5 - size,
			2*size - 1, 2*size - 1);
		this.ctx.moveTo(x, y);
	},

	'.': function (x, y, size) {
		size /=  2;
		this.ctx.moveTo(x + size, y);
		this.ctx.arc(x, y, size, 0, Math.PI*2, true);
		this.ctx.moveTo(x, y);
		this.ctx.fill();
		this.ctx.moveTo(x, y);
	}
};

var Plot = function (container, options) {
	var defaults = {
		width: 400,
		height: 300,
		marker: false,
		markerSize: 5,
		color: 'royalblue',
		line: true,
		axes: false,
		axisEqual: false,
		crosshair: false,
		xMin: undefined,
		xMax: undefined,
		yMin: undefined,
		yMax: undefined,
		xTicks: 6, // approximate
		yTicks: 6 // approximate
	};
	this._options = extend({}, defaults, options || {});

	this.lines = [];

	// DOM stuff
	this.canvas = document.createElement('canvas');
	this.ctx = this.canvas.getContext('2d');

	if (!container) {
		container = document.body;
	}
	else if (typeof container === 'string') {
		container = document.querySelector(container);
	}
	container.appendChild(this.canvas);

	this.canvas.width = this._options.width;
	this.canvas.height = this._options.height;
	this.setTransform();
};

Plot.prototype.options = function (options) {
	extend(this._options, options);
	this.canvas.width = this._options.width;
	this.canvas.height = this._options.height;
	this.setTransform();
	if (this.lines.length) {
		this.render();
	}
	return this;
};

Plot.prototype.size = function (width, height) {
	this.options({width: width, height: height});
	return this;
};

Plot.prototype.limits = function (xMin, xMax, yMin, yMax) {
	this.options({
		xMin: xMin,
		xMax: xMax,
		yMin: yMin,
		yMax: yMax
	});
	return this;
};

Plot.prototype.plot = function (x, y, options) {
	var line = new Line(this, x, y, options);
	// default line colors
	if (!line._options.color) {
		extend(line._options, {
			color: colors[this.lines.length % colors.length]
		});
	}
	this.lines.push(line);
	this.render();
	return line;
};

Plot.prototype.setTransform = function () {
	var paddingTop = 15, paddingRight = 15, paddingBottom = 15, paddingLeft = 15;
	if (this._options.axes) {
		paddingBottom = xAxisHeight;
		paddingLeft = yAxisWidth;
	}
	this.width = this._options.width - paddingLeft - paddingRight;
	this.height = this._options.height - paddingTop - paddingBottom;
	this.ctx.translate(paddingLeft, this.height + paddingTop);
	this.ctx.scale(1, -1);
};

Plot.prototype.updateViewport = function () {
	var xMax, xMin, yMax, yMin;

	for (var j = 0, len = this.lines.length; j < len; j++) {
		xMax = Math.max.apply(this, this.lines[j].x);
		xMin = Math.min.apply(this, this.lines[j].x);
		yMax = Math.max.apply(this, this.lines[j].y);
		yMin = Math.min.apply(this, this.lines[j].y);

		if (j === 0 || xMax > this.xMax) { this.xMax = xMax; }
		if (j === 0 || xMin < this.xMin) { this.xMin = xMin; }
		if (j === 0 || yMax > this.yMax) { this.yMax = yMax; }
		if (j === 0 || yMin < this.yMin) { this.yMin = yMin; }
	}

	var xSpan = this.xMax - this.xMin;
	var ySpan = this.yMax - this.yMin;

	// ~15 px margin to axes
	if (this._options.axes) {
		this.xMin -= 15 * xSpan / this.width;
		this.yMin -= 15 * ySpan / this.height;
		xSpan = this.xMax - this.xMin;
		ySpan = this.yMax - this.yMin;
	}

	if (this._options.axisEqual) {
		var xMid = this.xMin + xSpan / 2;
		var yMid = this.yMin + ySpan / 2;

		// minimum pixels per length (x or y)
		var scale = Math.min(this.width / xSpan, this.height / ySpan);

		this.xMin = xMid - 0.5 * this.width / scale;
		this.xMax = xMid + 0.5 * this.width / scale;
		this.yMin = yMid - 0.5 * this.height / scale;
		this.yMax = yMid + 0.5 * this.height / scale;
	}

	// override if there are user specified min/max values
	if (this._options.xMin !== undefined) this.xMin = this._options.xMin;
	if (this._options.xMax !== undefined) this.xMax = this._options.xMax;
	if (this._options.yMin !== undefined) this.yMin = this._options.yMin;
	if (this._options.yMax !== undefined) this.yMax = this._options.yMax;
};

Plot.prototype.render = function () {
	this.updateViewport();

	// clear canvas
	this.ctx.save();
	this.ctx.setTransform(1, 0, 0, 1, 0, 0);
	this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	this.ctx.restore();

	// crosshair
	if (this._options.crosshair) {
		this.drawCrosshair();
	}

	// lines
	for (var j = 0; j < this.lines.length; j++) {
		this.drawLine(this.lines[j]);
	}

	// axes
	if (this._options.axes) {
		this.ctx.save();
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.clearRect(0, 0, yAxisWidth, this.canvas.height);
		this.ctx.clearRect(0, this.canvas.height - xAxisHeight, this.canvas.width, xAxisHeight);
		this.ctx.restore();

		this.ctx.font = '15px Calibri, sans-serif';
		this.ctx.fillStyle = 'black';
		this.drawXAxis();
		this.drawYAxis();
	}
};

Plot.prototype.drawLine = function (line) {

	// make copy to leave original intact
	var x = line.x.slice();
	var y = line.y.slice();
	var i, len = x.length;
	var lastWasNull = false;

	// adjust to plot size
	for (i = 0; i < len; i++) {
		if (x[i] !== null) {
			x[i] = (x[i] - this.xMin) / (this.xMax - this.xMin) * this.width;
		}
		if (y[i] !== null) {
			y[i] = (y[i] - this.yMin) / (this.yMax - this.yMin) * this.height;
		}
	}

	var options = extend({}, this._options, line._options);
	this.ctx.strokeStyle = this.ctx.fillStyle = options.color;

	this.ctx.beginPath();
	this.ctx.moveTo(x[0], y[0]);

	for (i = 0; i < len; i++) {
		if (x[i] === null || y[i] === null) {
			lastWasNull = true;
			continue;
		}

		if (lastWasNull) {
			this.ctx.moveTo(x[i], y[i]);
		}
		else if (options.line) {
			this.ctx.lineTo(x[i], y[i]);
		}
		if (markerAt.hasOwnProperty(options.marker)) {
			markerAt[options.marker].call(this, x[i], y[i], options.markerSize);
		}
		lastWasNull = false;
	}

	this.ctx.stroke();
};

Plot.prototype.drawCrosshair = function () {
	if (this.xMin <= 0 && 0 <= this.xMax) {
		this.drawLine({
			x: [0, 0],
			y: [this.yMin, this.yMax],
			_options: {color: 'lightgray', marker: false}
		});
	}
	if (this.yMin <= 0 && 0 <= this.yMax) {
		this.drawLine({
			x: [this.xMin, this.xMax],
			y: [0, 0],
			_options: {color: 'lightgray', marker: false}
		});
	}
};

Plot.prototype.getTicks = function (axis) {
	var min = this[axis + 'Min'];
	var max = this[axis + 'Max'];
	var minFixed = this._options[axis + 'Min'] !== undefined;
	var maxFixed = this._options[axis + 'Max'] !== undefined;
	var numOfTicks = this._options[axis + 'Ticks'];
	
	var log10 = function (x) {
		return Math.log(x) / Math.LN10;
	};

	var step = (max - min) / (numOfTicks - 1);
	// magnitude of step size
	var stepMagn = Math.pow(10, Math.floor(log10(step)));
	var stepRound = stepMagn * Math.round(step / stepMagn);
	
	// explicitly allow 0.25 and 0.75
	if (Math.abs(stepMagn * 2.5 - step) < Math.abs(stepRound - step)) {
		stepRound = stepMagn * 2.5;
	}
	
	// Set starting point to closest round number larger than min
	var start = stepMagn * Math.ceil(min / stepMagn);

	if (minFixed) {
		start = min;
	}
	else if (min <= 0 && max >= 0) {
		start = 0;
	}
	
	var ticks = [start];
	// fill left from starting point
	while (ticks[0] - stepRound >= min) {
		ticks.unshift(ticks[0] - stepRound);
	}
	// fill right from starting point
	while (ticks[ticks.length - 1] + stepRound <= max) {
		ticks.push(ticks[ticks.length - 1] + stepRound);
	}
	
	if (maxFixed) {
		if (max - ticks[ticks.length - 1] < stepRound / 2) {
			ticks.pop();
		}
		ticks.push(max);
	}
	
	return ticks;
};

var prettyNum = function (x) {
	var str = x.toString();
	var eps = 1e-16;
	// no 1.00000000000001 or 0.999999999999999
	if (str.length < 17) {
		return str;
	}
	// special case zero
	if (x > -eps && x < eps) {
		return '0';
	}
	// make some different small perturbations and check if the string got shorter
	for (var factor = 0; factor < 20; factor++) {
		// require improvement by 2 decimals
		if ((x + factor*x*eps).toString().length <= str.length - 2) {
			return (x + factor*x*eps).toString();
		}
		if ((x - factor*x*eps).toString().length <= str.length - 2) {
			return (x - factor*x*eps).toString();
		}
	}
	return str;
};

Plot.prototype.drawXAxis = function () {
	var ticks = this.getTicks('x'); 
	var x, y = 0;
	var size = 5;

	this.ctx.beginPath();
	this.ctx.moveTo(0, y + 0.5);
	this.ctx.lineTo(this.width + 1, y + 0.5);
	this.ctx.textAlign = 'center';

	for (var i = 0, len = ticks.length; i < len; i++) {
		// adjust to plot size
		x = (ticks[i] - this.xMin) / (this.xMax - this.xMin) * this.width;

		this.ctx.moveTo(Math.floor(x) + 0.5, y - size);
		this.ctx.lineTo(Math.floor(x) + 0.5, y);

		this.ctx.save();
		this.ctx.scale(1, -1);
		this.ctx.fillText(prettyNum(ticks[i]), x, -y + 20);
		this.ctx.restore();
	}
	this.ctx.strokeStyle = 'black';
	this.ctx.stroke();
};

Plot.prototype.drawYAxis = function () {
	var ticks = this.getTicks('y'); 
	var x = 0, y;
	var size = 5;

	this.ctx.beginPath();
	this.ctx.moveTo(x + 0.5, 0);
	this.ctx.lineTo(x + 0.5, this.height + 1);
	this.ctx.textAlign = 'right';

	for (var i = 0, len = ticks.length; i < len; i++) {
		// adjust to plot size
		y = (ticks[i] - this.yMin) / (this.yMax - this.yMin) * this.height;

		this.ctx.moveTo(x - size, Math.floor(y) + 0.5);
		this.ctx.lineTo(x, Math.floor(y) + 0.5);

		this.ctx.save();
		this.ctx.scale(1, -1);
		this.ctx.fillText(prettyNum(ticks[i]), x - 12, -y + 4);
		this.ctx.restore();
	}
	this.ctx.strokeStyle = 'black';
	this.ctx.stroke();
};

Plot.prototype.lineRemove = function () {
	for (var i = 0; i < this.lines.length; i++) {
		if (this.lines[i].dead) {
			this.lines.splice(i, 1);
		}
	}
	this.render();
};

window.Plot = Plot;

})();