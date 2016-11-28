angular.module('common.fabric.canvas', [
    'common.fabric.window'
])

.service('FabricCanvas', ['FabricWindow', '$rootScope', function(FabricWindow, $rootScope) {
    'use strict';

    var self = {
        canvasId: null,
        element: null,
        canvas: null
    };

    function createId() {
        return Math.floor(Math.random() * 10000);
    }

    self.setElement = function(element) {
        self.element = element;
        $rootScope.$broadcast('canvas:element:selected');
    };

    self.createCanvas = function() {
        self.canvasId = 'fabric-canvas-' + createId();
        self.element.attr('id', self.canvasId);
        self.canvas = new FabricWindow.Canvas(self.canvasId);
        $rootScope.$broadcast('canvas:created');

        return self.canvas;
    };

    self.getCanvas = function() {
        return self.canvas;
    };

    self.getCanvasId = function() {
        return self.canvasId;
    };

    self.fixCanvasToBoundary = function (options) {
        if (!options.target) {
            return;
        }

        var obj = options.target;
        // if object is too big ignore
        if (obj.currentHeight > obj.canvas.height || obj.currentWidth > obj.canvas.width) {
            return;
        }

        obj.setCoords();
        var boundingObj = obj.getBoundingRect();

        // top-left  corner
        if(boundingObj.top < 0 || boundingObj.left < 0) {
            obj.top = Math.max(obj.top, obj.top - boundingObj.top);
            obj.left = Math.max(obj.left, obj.left - boundingObj.left);
        }

        // bot-right corner
        if (boundingObj.top + boundingObj.height > obj.canvas.height ||
            boundingObj.left+boundingObj.width > obj.canvas.width) {
            obj.top = Math.min(obj.top,
                obj.canvas.height - boundingObj.height + obj.top - boundingObj.top);
            obj.left = Math.min(obj.left,
                obj.canvas.width - boundingObj.width + obj.left - boundingObj.left);
        }
    };

    self.focusCanvasWrapper = function (canvasRef) {
        canvasRef = canvasRef.canvas || self.canvas;

        canvasRef.wrapperEl.focus();
    };

    self.calculateTextWidth = function (txtObj) {
        var originalAlign = txtObj.textAlign;
        var ctx = txtObj.ctx;
        ctx.save();
        txtObj._setTextStyles(ctx);
        txtObj.textAlign = 'left';

        var text = txtObj.text;
        var lineWidth = 0,
            lineIndex = 0,
            line = '',
            words = text.split(' '),
            word = '',
            offset = 0,
            infix = ' ',
            wordWidth = 0,
            infixWidth = 0,
            largestWordWidth = 0,
            lineJustStarted = true,
            additionalSpace = txtObj._getWidthOfCharSpacing();

        for (var i = 0; i < words.length; i++) {
            word = words[i];
            wordWidth = txtObj._measureText(ctx, word, lineIndex, offset);

            offset += word.length;

            lineWidth += infixWidth + wordWidth - additionalSpace;
            lineWidth += additionalSpace;

            if (!lineJustStarted) {
                line += infix;
            }
            line += word;

            infixWidth = txtObj._measureText(ctx, infix, lineIndex, offset);
            offset++;
            lineJustStarted = false;
            // keep track of largest word
            if (wordWidth > largestWordWidth) {
                largestWordWidth = wordWidth;
            }
        }

        txtObj.textAlign = originalAlign;
        ctx.restore();
        return lineWidth;
    };

    self.resizeTextBox = function (txtObj, maxSize) {
        var calculateWidth = self.calculateTextWidth(txtObj) + 5;
        if (maxSize && calculateWidth > maxSize) {
            calculateWidth = maxSize;
        }

        txtObj.width = calculateWidth;
    };

    return self;

}]);
