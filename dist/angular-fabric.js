angular.module('common.fabric', [
  'common.fabric.window',
  'common.fabric.directive',
  'common.fabric.canvas',
  'common.fabric.dirtyStatus'
])

  .factory('Fabric', [
    'FabricWindow', '$timeout', '$window', 'FabricCanvas', 'FabricDirtyStatus',
    function (FabricWindow, $timeout, $window, FabricCanvas, FabricDirtyStatus) {
      'use strict';

      return function (options) {

        var canvas;
        var JSONObject;
        var self = angular.extend({
          canvasBackgroundColor: '#ffffff',
          canvasWidth: 300,
          canvasHeight: 300,
          canvasOriginalHeight: 300,
          canvasOriginalWidth: 300,
          maxContinuousRenderLoops: 25,
          continuousRenderTimeDelay: 500,
          editable: true,
          JSONExportProperties: [],
          loading: false,
          dirty: false,
          initialized: false,
          userHasClickedCanvas: false,
          downloadMultipler: 2,
          imageDefaults: {},
          textDefaults: {},
          shapeDefaults: {},
          windowDefaults: {
            transparentCorners: false,
            rotatingPointOffset: 25,
            padding: 0
          },
          canvasDefaults: {
            selection: false
          }
        }, options);

        function capitalize(string) {
          if (typeof string !== 'string') {
            return '';
          }

          return string.charAt(0).toUpperCase() + string.slice(1);
        }

        function getActiveStyle(styleName, object) {
          object = object || canvas.getActiveObject();

          if (typeof object !== 'object' || object === null) {
            return '';
          }

          return (object.getSelectionStyles && object.isEditing) ?
            (object.getSelectionStyles()[styleName] || '') :
            (object[styleName] || '');
        }

        function setActiveStyle(styleName, value, object) {
          object = object || canvas.getActiveObject();

          if (object.setSelectionStyles && object.isEditing) {
            var style = {};
            style[styleName] = value;
            object.setSelectionStyles(style);
          } else {
            object[styleName] = value;
          }

          self.render();
        }

        function getActiveProp(name, object) {
          object = object || canvas.getActiveObject();

          return typeof object === 'object' && object !== null ?
            object[name] :
            '';
        }

        function setActiveProp(name, value, object) {
          object = object || canvas.getActiveObject();
          object.set(name, value);
          self.render();
        }

        function b64toBlob(b64Data, contentType, sliceSize) {
          contentType = contentType || '';
          sliceSize = sliceSize || 512;

          var byteCharacters = atob(b64Data);
          var byteArrays = [];

          for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            var slice = byteCharacters.slice(offset, offset + sliceSize);

            var byteNumbers = new Array(slice.length);
            for (var i = 0; i < slice.length; i++) {
              byteNumbers[i] = slice.charCodeAt(i);
            }

            var byteArray = new Uint8Array(byteNumbers);

            byteArrays.push(byteArray);
          }

          var blob = new Blob(byteArrays, { type: contentType });
          return blob;
        }

        function isHex(str) {
          return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/gi.test(str);
        }

        //
        // Canvas
        // ==============================================================
        self.renderCount = 0;
        self.render = function () {
          var objects = canvas.getObjects();
          for (var i in objects) {
            objects[i].setCoords();
          }

          canvas.calcOffset();
          canvas.renderAll();
          self.renderCount++;
        };

        self.setCanvas = function (newCanvas) {
          canvas = newCanvas;
          canvas.selection = self.canvasDefaults.selection;
        };

        self.setTextDefaults = function (textDefaults) {
          self.textDefaults = textDefaults;
        };

        self.setJSONExportProperties = function (JSONExportProperties) {
          self.JSONExportProperties = JSONExportProperties;
        };

        self.setCanvasBackgroundColor = function (color) {
          self.canvasBackgroundColor = color;
          canvas.setBackgroundColor(color);
          self.render();
        };

        self.setCanvasWidth = function (width) {
          self.canvasWidth = width;
          canvas.setWidth(width);
          self.render();
        };

        self.setCanvasHeight = function (height) {
          self.canvasHeight = height;
          canvas.setHeight(height);
          self.render();
        };

        self.setCanvasSize = function (width, height) {
          self.stopContinuousRendering();
          var initialCanvasScale = self.canvasScale;
          self.resetZoom();

          self.canvasWidth = width;
          self.canvasOriginalWidth = width;
          canvas.originalWidth = width;
          canvas.setWidth(width);

          self.canvasHeight = height;
          self.canvasOriginalHeight = height;
          canvas.originalHeight = height;
          canvas.setHeight(height);

          self.canvasScale = initialCanvasScale;
          self.render();
          self.setZoom();
          self.render();
          self.setZoom();
        };

        self.deactivateAll = function () {
          canvas.deactivateAll();
          self.deselectActiveObject();
          self.render();
        };

        self.clearCanvas = function () {
          canvas.clear();
          canvas.setBackgroundColor('#ffffff');
          self.render();
        };

        //
        // Creating Objects
        // ==============================================================
        self.addObjectToCanvas = function (object) {
          object.originalScaleX = object.scaleX;
          object.originalScaleY = object.scaleY;
          object.originalLeft = object.left;
          object.originalTop = object.top;

          canvas.add(object);
          self.setObjectZoom(object);
          canvas.setActiveObject(object);
          object.bringToFront();
          self.center();
          self.render();
        };

        //
        // Image
        // ==============================================================
        self.addImage = function (imageURL, callback) {
          FabricWindow.Image.fromURL(imageURL, function (object) {
            object.id = self.createId();

            for (var p in self.imageOptions) {
              object[p] = self.imageOptions[p];
            }

            // Add a filter that can be used to turn the image
            // into a solid colored shape.
            var filter = new FabricWindow.Image.filters.Tint({
              color: '#ffffff',
              opacity: 0
            });
            object.filters.push(filter);
            object.applyFilters(canvas.renderAll.bind(canvas));

            self.addObjectToCanvas(object);

            callback(object);
          }, self.imageDefaults);
        };

        self.getCanvas = function () {
          return canvas;
        };

        //
        // Shape
        // ==============================================================
        self.addShape = function (svgURL, options, callback) {
          FabricWindow.loadSVGFromURL(svgURL, function (objects, options) {
            var object = FabricWindow.util.groupSVGElements(objects, options);
            object.id = self.createId();

            self.addObjectToCanvas(object);

            callback(object);
          });
        };

        //
        // Text
        // ==============================================================
        self.addText = function (str) {
          str = str || 'New Text';
          var object = new FabricWindow.Text(str, self.textDefaults);
          object.id = self.createId();

          self.addObjectToCanvas(object);

          return object;
        };

        self.addIText = function (str) {
          str = str || 'New Text';
          var object = new FabricWindow.IText(str, self.textDefaults);
          object.id = self.createId();

          self.addObjectToCanvas(object);

          return object;
        };

        self.addTextbox = function (str, isEditable) {
          str = str || 'New Text';
          isEditable = isEditable || false;
          var object = new FabricWindow.Textbox(str, self.textDefaults);
          object.id = self.createId();
          object.editable = isEditable;

          self.addObjectToCanvas(object);

          return object;
        };

        self.getText = function (object) {
          return getActiveProp('text', object);
        };

        self.setText = function (value, object) {
          setActiveProp('text', value, object);
        };

        //
        // Font Size
        // ==============================================================
        self.getFontSize = function (object) {
          return getActiveStyle('fontSize', object);
        };

        self.setFontSize = function (value, object) {
          setActiveStyle('fontSize', parseInt(value, 10), object);
          self.render();
        };

        //
        // Text Align
        // ==============================================================
        self.getTextAlign = function (object) {
          return capitalize(getActiveProp('textAlign', object));
        };

        self.setTextAlign = function (value, object) {
          setActiveProp('textAlign', value.toLowerCase()), object;
        };

        //
        // Font Family
        // ==============================================================
        self.getFontFamily = function (object) {
          var fontFamily = getActiveProp('fontFamily', object);
          return fontFamily ? fontFamily.toLowerCase() : '';
        };

        self.setFontFamily = function (value, object) {
          setActiveProp('fontFamily', value.toLowerCase(), object);
        };

        //
        // Lineheight
        // ==============================================================
        self.getLineHeight = function (object) {
          return getActiveStyle('lineHeight', object);
        };

        self.setLineHeight = function (value) {
          setActiveStyle('lineHeight', parseFloat(value, 10), object);
          self.render();
        };

        //
        // Bold
        // ==============================================================
        self.isBold = function (object) {
          return getActiveStyle('fontWeight', object) === 'bold';
        };

        self.toggleBold = function (object) {
          setActiveStyle('fontWeight',
            getActiveStyle('fontWeight', object) === 'bold' ? '' : 'bold',
            object);
          self.render();
        };

        //
        // Italic
        // ==============================================================
        self.isItalic = function (object) {
          return getActiveStyle('fontStyle', object) === 'italic';
        };

        self.toggleItalic = function (object) {
          setActiveStyle('fontStyle',
            getActiveStyle('fontStyle', object) === 'italic' ? '' : 'italic',
            object);
          self.render();
        };

        //
        // Underline
        // ==============================================================
        self.isUnderline = function (object) {
          return getActiveStyle('textDecoration', object).indexOf('underline') > -1;
        };

        self.toggleUnderline = function (object) {
          var value = self.isUnderline(object) ?
            getActiveStyle('textDecoration', object).replace('underline', '') :
            (getActiveStyle('textDecoration', object) + ' underline');

          setActiveStyle('textDecoration', value, object);
          self.render();
        };

        //
        // Linethrough
        // ==============================================================
        self.isLinethrough = function (object) {
          return getActiveStyle('textDecoration', object).indexOf('line-through') > -1;
        };

        self.toggleLinethrough = function (object) {
          var value = self.isLinethrough(object) ?
            getActiveStyle('textDecoration', object).replace('line-through', '') :
            (getActiveStyle('textDecoration', object) + ' line-through');

          setActiveStyle('textDecoration', value, object);
          self.render();
        };

        //
        // Text Align
        // ==============================================================
        self.getTextAlign = function (object) {
          return getActiveProp('textAlign', object);
        };

        self.setTextAlign = function (value, object) {
          setActiveProp('textAlign', value, object);
        };

        //
        // Opacity
        // ==============================================================
        self.getOpacity = function (object) {
          return getActiveStyle('opacity', object);
        };

        self.setOpacity = function (value, object) {
          setActiveStyle('opacity', value, object);
        };

        //
        // FlipX
        // ==============================================================
        self.getFlipX = function (object) {
          return getActiveProp('flipX', object);
        };

        self.setFlipX = function (value, object) {
          setActiveProp('flipX', value, object);
        };

        self.toggleFlipX = function (object) {
          var value = !self.getFlipX(object);
          self.setFlipX(value, object);
          self.render();
        };

        //
        // Align Active Object
        // ==============================================================
        self.center = function (object) {
          object = object || canvas.getActiveObject();
          if (!!object) {
            object.center();
            self.updateObjectOriginals(object);
            self.render();
          }
        };

        self.centerH = function (object) {
          object = object || canvas.getActiveObject();
          if (object) {
            object.centerH();
            self.updateObjectOriginals(object);
            self.render();
          }
        };

        self.centerV = function (object) {
          object = object || canvas.getActiveObject();
          if (object) {
            object.centerV();
            self.updateObjectOriginals(object);
            self.render();
          }
        };

        //
        // Active Object Layer Position
        // ==============================================================
        self.sendBackwards = function (object) {
          object = object || canvas.getActiveObject();
          if (object) {
            canvas.sendBackwards(object);
            self.render();
          }
        };

        self.sendToBack = function (object) {
          object = object || canvas.getActiveObject();
          if (object) {
            canvas.sendToBack(object);
            self.render();
          }
        };

        self.bringForward = function (object) {
          object = object || canvas.getActiveObject();
          if (object) {
            canvas.bringForward(object);
            self.render();
          }
        };

        self.bringToFront = function (object) {
          object = object || canvas.getActiveObject();
          if (object) {
            canvas.bringToFront(object);
            self.render();
          }
        };

        //
        // Active Object Tint Color
        // ==============================================================
        self.isTinted = function (object) {
          return getActiveProp('isTinted', object);
        };

        self.toggleTint = function (object) {
          object = object || canvas.getActiveObject();
          object.isTinted = !object.isTinted;
          object.filters[0].opacity = object.isTinted ? 1 : 0;
          object.applyFilters(canvas.renderAll.bind(canvas));
        };

        self.getTint = function (object) {
          object = object || canvas.getActiveObject();

          if (typeof object !== 'object' || object === null) {
            return '';
          }

          if (object.filters !== undefined) {
            if (object.filters[0] !== undefined) {
              return object.filters[0].color;
            }
          }
        };

        self.setTint = function (tint, object) {
          if (!isHex(tint)) {
            return;
          }

          object = object || canvas.getActiveObject();
          if (object.filters !== undefined) {
            if (object.filters[0] !== undefined) {
              object.filters[0].color = tint;
              object.applyFilters(canvas.renderAll.bind(canvas));
            }
          }
        };

        //
        // Active Object Fill Color
        // ==============================================================
        self.getFill = function (object) {
          return getActiveStyle('fill', object);
        };

        self.setFill = function (value, object) {
          object = object || canvas.getActiveObject();
          if (object) {
            if (object.type === 'text') {
              setActiveStyle('fill', value, object);
            } else {
              self.setFillPath(object, value);
            }
          }
        };

        self.setFillPath = function (object, value) {
          if (object.isSameColor && object.isSameColor() || !object.paths) {
            object.setFill(value);
          } else if (object.paths) {
            for (var i = 0; i < object.paths.length; i++) {
              object.paths[i].setFill(value);
            }
          }
        };

        //
        // Canvas Zoom
        // ==============================================================
        self.resetZoom = function () {
          self.canvasScale = 1;
          self.setZoom();
        };

        self.setZoom = function () {
          var objects = canvas.getObjects();
          for (var i in objects) {
            objects[i].originalScaleX = objects[i].originalScaleX ?
              objects[i].originalScaleX :
              objects[i].scaleX;
            objects[i].originalScaleY = objects[i].originalScaleY ?
              objects[i].originalScaleY :
              objects[i].scaleY;
            objects[i].originalLeft = objects[i].originalLeft ?
              objects[i].originalLeft :
              objects[i].left;
            objects[i].originalTop = objects[i].originalTop ?
              objects[i].originalTop :
              objects[i].top;
            self.setObjectZoom(objects[i]);
          }

          self.setCanvasZoom();
          self.render();
        };

        self.setObjectZoom = function (object) {
          var scaleX = object.originalScaleX;
          var scaleY = object.originalScaleY;
          var left = object.originalLeft;
          var top = object.originalTop;

          var tempScaleX = scaleX * self.canvasScale;
          var tempScaleY = scaleY * self.canvasScale;
          var tempLeft = left * self.canvasScale;
          var tempTop = top * self.canvasScale;

          object.scaleX = tempScaleX;
          object.scaleY = tempScaleY;
          object.left = tempLeft;
          object.top = tempTop;

          object.setCoords();
        };

        self.setCanvasZoom = function () {
          var width = self.canvasOriginalWidth;
          var height = self.canvasOriginalHeight;

          var tempWidth = width * self.canvasScale;
          var tempHeight = height * self.canvasScale;

          canvas.setWidth(tempWidth);
          canvas.setHeight(tempHeight);
        };

        self.updateObjectOriginals = function (object) {
          if (object) {
            object.originalScaleX = object.scaleX / self.canvasScale;
            object.originalScaleY = object.scaleY / self.canvasScale;
            object.originalLeft = object.left / self.canvasScale;
            object.originalTop = object.top / self.canvasScale;
          }
        };

        self.updateActiveObjectOriginals = function () {
          var object = canvas.getActiveObject();
          self.updateObjectOriginals(object);
        };

        //
        // Active Object Lock
        // ==============================================================
        self.toggleLock = function (object) {
          if (object) {
            object.lockMovementX = !object.lockMovementX;
            object.lockMovementY = !object.lockMovementY;
            object.lockScalingX = !object.lockScalingX;
            object.lockScalingY = !object.lockScalingY;
            object.lockUniScaling = !object.lockUniScaling;
            object.lockRotation = !object.lockRotation;
            object.lockObject = !object.lockObject;
            self.render();
          }
        };

        self.toggleLockActiveObject = function () {
          var activeObject = canvas.getActiveObject();
          self.toggleLock(activeObject);
        };

        //
        // Active Object
        // ==============================================================
        self.selectActiveObject = function (object) {
          object = object || canvas.getActiveObject();
          if (!object) {
            return;
          }

          self.selectedObject = object;
          self.selectedObject.text = self.getText(object);
          self.selectedObject.fontSize = self.getFontSize(object);
          self.selectedObject.lineHeight = self.getLineHeight(object);
          self.selectedObject.textAlign = self.getTextAlign(object);
          self.selectedObject.opacity = self.getOpacity(object);
          self.selectedObject.fontFamily = self.getFontFamily(object);
          self.selectedObject.fill = self.getFill(object);
          self.selectedObject.tint = self.getTint(object);
        };

        self.deselectActiveObject = function () {
          self.selectedObject = false;
        };

        self.deleteObject = function (object) {
          canvas.remove(object);
          self.render();
        };

        self.deleteActiveObject = function () {
          var activeObject = canvas.getActiveObject();
          self.deleteObject(activeObject);
        };

        //
        // State Managers
        // ==============================================================
        self.isLoading = function () {
          return self.loading;
        };

        self.setLoading = function (value) {
          self.loading = value;
        };

        self.setDirty = function (value) {
          FabricDirtyStatus.setDirty(value);
        };

        self.isDirty = function () {
          return FabricDirtyStatus.isDirty();
        };

        self.setInitalized = function (value) {
          self.initialized = value;
        };

        self.isInitalized = function () {
          return self.initialized;
        };

        //
        // JSON
        // ==============================================================
        self.getJSON = function (object) {
          var objectToJSON = object || canvas;
          var initialCanvasScale = self.canvasScale;
          self.canvasScale = 1;
          self.resetZoom();

          var json = angular.toJson(objectToJSON.toJSON(self.JSONExportProperties));

          self.canvasScale = initialCanvasScale;
          self.setZoom();

          return json;
        };

        self.loadJSON = function (json, callback) {
          self.setLoading(true);
          canvas.loadFromJSON(json, function () {
            $timeout(function () {
              self.setLoading(false);

              if (!self.editable) {
                self.disableEditing();
              }

              self.render();

              if (angular.isDefined(callback)) {
                callback();
              }
            });
          });
        };

        //
        // Download Canvas
        // ==============================================================
        self.getCanvasData = function (object) {
          var objectToSave = object || canvas;
          var data = objectToSave.toDataURL({
            width: object ? undefined : objectToSave.getWidth(),
            height: object ? undefined : objectToSave.getHeight(),
            multiplier: self.downloadMultipler
          });

          return data;
        };

        self.getCanvasBlob = function (object) {
          var blob = self.getCanvasBlobData(object);
          var blobUrl = URL.createObjectURL(blob);
          return blobUrl;
        };

        self.getCanvasBlobData = function (object) {
          var base64Data = self.getCanvasData(object);
          var data = base64Data.replace('data:image/png;base64,', '');
          var blob = b64toBlob(data, 'image/png');

          return blob;
        };

        self.download = function (name) {
          // Stops active object outline from showing in image
          self.deactivateAll();

          var initialCanvasScale = self.canvasScale;
          self.resetZoom();

          // Click an artifical anchor to 'force' download.
          var link = document.createElement('a');
          var filename = name + '.png';
          link.download = filename;
          link.href = self.getCanvasBlob();
          link.click();

          self.canvasScale = initialCanvasScale;
          self.setZoom();
        };

        //
        // Continuous Rendering
        // ==============================================================
        // Upon initialization re render the canvas
        // to account for fonts loaded from CDN's
        // or other lazy loaded items.

        // Prevent infinite rendering loop
        self.continuousRenderCounter = 0;
        self.continuousRenderHandle = null;

        self.stopContinuousRendering = function () {
          $timeout.cancel(self.continuousRenderHandle);
          self.continuousRenderCounter = self.maxContinuousRenderLoops;
        };

        self.startContinuousRendering = function () {
          self.continuousRenderCounter = 0;
          self.continuousRender();
        };

        // Prevents the "not fully rendered up upon init for a few seconds" bug.
        self.continuousRender = function () {
          if (self.userHasClickedCanvas ||
            self.continuousRenderCounter > self.maxContinuousRenderLoops) {
            return;
          }

          self.continuousRenderHandle = $timeout(function () {
            self.setZoom();
            self.render();
            self.continuousRenderCounter++;
            self.continuousRender();
          }, self.continuousRenderTimeDelay);
        };

        //
        // Utility
        // ==============================================================
        self.setUserHasClickedCanvas = function (value) {
          self.userHasClickedCanvas = value;
        };

        self.createId = function () {
          return Math.floor(Math.random() * 10000);
        };

        //
        // Toggle Object Selectability
        // ==============================================================
        self.disableEditing = function () {
          canvas.selection = false;
          canvas.forEachObject(function (object) {
            object.selectable = false;
          });
        };

        self.enableEditing = function () {
          canvas.selection = true;
          canvas.forEachObject(function (object) {
            object.selectable = true;
          });
        };

        self.setCanvasBackgroundImage = function (image) {
          self.backgroundImage = image;
          canvas.setBackgroundImage(image);
          self.render();
        };

        //
        // Set Global Defaults
        // ==============================================================
        self.setCanvasDefaults = function () {
          canvas.selection = self.canvasDefaults.selection;
        };

        self.setWindowDefaults = function () {
          FabricWindow.Object.prototype.transparentCorners =
            self.windowDefaults.transparentCorners;
          FabricWindow.Object.prototype.rotatingPointOffset =
            self.windowDefaults.rotatingPointOffset;
          FabricWindow.Object.prototype.padding = self.windowDefaults.padding;
        };

        //
        // Canvas Listeners
        // ============================================================
        self.startCanvasListeners = function () {
          canvas.on('object:selected', function () {
            self.stopContinuousRendering();
            $timeout(function () {
              self.selectActiveObject();
              self.setDirty(true);
            });
          });

          canvas.on('selection:created', function () {
            self.stopContinuousRendering();
          });

          canvas.on('selection:cleared', function () {
            $timeout(function () {
              self.deselectActiveObject();
            });
          });

          canvas.on('after:render', function () {
            canvas.calcOffset();
          });

          canvas.on('object:modified', function () {
            self.stopContinuousRendering();
            $timeout(function () {
              self.updateActiveObjectOriginals();
              self.setDirty(true);
            });
          });
        };

        //
        // Constructor
        // ==============================================================
        self.init = function () {
          canvas = FabricCanvas.getCanvas();
          self.canvasId = FabricCanvas.getCanvasId();
          canvas.clear();

          // For easily accessing the json
          JSONObject = angular.fromJson(self.json);
          self.loadJSON(self.json);

          JSONObject = JSONObject || {};

          self.canvasScale = 1;

          JSONObject.background = JSONObject.background || '#ffffff';
          self.setCanvasBackgroundColor(JSONObject.background);
          self.setCanvasBackgroundImage(JSONObject.bgDefaultImage);

          // Set the size of the canvas
          JSONObject.width = JSONObject.width || 300;
          self.canvasOriginalWidth = JSONObject.width;

          JSONObject.height = JSONObject.height || 300;
          self.canvasOriginalHeight = JSONObject.height;

          self.setCanvasSize(self.canvasOriginalWidth, self.canvasOriginalHeight);

          self.render();
          self.setDirty(false);
          self.setInitalized(true);

          self.setCanvasDefaults();
          self.setWindowDefaults();
          self.startCanvasListeners();
          self.startContinuousRendering();
          FabricDirtyStatus.startListening();
        };

        self.init();

        return self;

      };

    }]);

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

angular.module('common.fabric.constants', [])

.service('FabricConstants', [function() {
	'use strict';

	var objectDefaults = {
		rotatingPointOffset: 20,
		padding: 0,
		borderColor: 'EEF6FC',
		cornerColor: 'rgba(64, 159, 221, 1)',
		cornerSize: 10,
		transparentCorners: false,
		hasRotatingPoint: true,
		centerTransform: true
	};

	return {

		presetSizes: [
			{
				name: 'Portrait (8.5 x 11)',
				height: 1947,
				width: 1510
			},
			{
				name: 'Landscape (11 x 8.5)',
				width: 1947,
				height: 1510
			},
			{
				name: 'Business Card (3.5 x 2)',
				height: 368,
				width: 630
			},
			{
				name: 'Postcard (6 x 4)',
				height: 718,
				width: 1068
			},
			{
				name: 'Content/Builder Product Thumbnail',
				height: 400,
				width: 760
			},
			{
				name: 'Badge',
				height: 400,
				width: 400
			},
			{
				name: 'Facebook Profile Picture',
				height: 300,
				width: 300
			},
			{
				name: 'Facebook Cover Picture',
				height: 315,
				width: 851
			},
			{
				name: 'Facebook Photo Post (Landscape)',
				height: 504,
				width: 403
			},
			{
				name: 'Facebook Photo Post (Horizontal)',
				height: 1008,
				width: 806
			},
			{
				name: 'Facebook Full-Width Photo Post',
				height: 504,
				width: 843
			}
		],

		fonts: [
			{ name: 'Arial' },
			{ name: 'Impact' },
			{ name: 'Tahoma' }
		],

		shapeCategories: [
			{
				name: 'Popular Shapes',
				shapes: [
					'arrow6',
					'bubble4',
					'circle1',
					'rectangle1',
					'star1',
					'triangle1'
				]
			},
			{
				name: 'Simple Shapes',
				shapes: [
					'circle1',
					'heart1',
					'rectangle1',
					'triangle1',
					'star1',
					'star2',
					'star3',
					'square1'
				]
			},
			{
				name: 'Arrows & Pointers',
				shapes: [
					'arrow1',
					'arrow9',
					'arrow3',
					'arrow6',
				]
			},
			{
				name: 'Bubbles & Balloons',
				shapes: [
					'bubble5',
					'bubble4'
				]
			},
			{
				name: 'Check Marks',
				shapes: [

				]
			},
			{
				name: 'Badges',
				shapes: [
					'badge1',
					'badge2',
					'badge4',
					'badge5',
					'badge6'
				]
			}
		],

		JSONExportProperties: [
			'height',
			'width',
			'background',
			'objects',

			'originalHeight',
			'originalWidth',
			'originalScaleX',
			'originalScaleY',
			'originalLeft',
			'originalTop',

			'lineHeight',
			'lockMovementX',
			'lockMovementY',
			'lockScalingX',
			'lockScalingY',
			'lockUniScaling',
			'lockRotation',
			'lockObject',
			'id',
			'isTinted',
			'filters'
		],

		shapeDefaults: angular.extend({
			fill: '#0088cc'
		}, objectDefaults),

		textDefaults: angular.extend({
			originX: 'left',
			scaleX: 1,
			scaleY: 1,
			fontFamily: 'Arial',
			fontSize: 40,
			fill: '#454545',
			textAlign: 'left'
		}, objectDefaults)

	};

}]);

angular.module('common.fabric.directive', [
	'common.fabric.canvas'
])

.directive('fabric', [function() {
	'use strict';

	return {
		scope: {
			fabric: '@'
		},
		controller: DirectiveController
	};
}]);

DirectiveController.$inject = ['$scope', '$timeout', '$element', 'FabricCanvas'];

function DirectiveController($scope, $timeout, $element, FabricCanvas) {
	'use strict';

	var controller = function () {
		FabricCanvas.setElement($element);
		FabricCanvas.createCanvas();

		// Continue rendering the canvas until the user clicks
		// to avoid the "calcOffset" bug upon load.
		$('body').on('click', 'canvas', function() {
			if ($scope.fabric.setUserHasClickedCanvas) {
				$scope.fabric.setUserHasClickedCanvas(true);
			}
		});

		//
		// Watching Controller Variables
		// ============================================================
		$scope.$watch('fabric.canvasBackgroundColor', function(newVal) {
			if ($scope.fabric.setCanvasBackgroundColor) {
				$scope.fabric.setCanvasBackgroundColor(newVal);
			}
		});

		$scope.$watch('fabric.selectedObject.text', function(newVal) {
			if (typeof newVal === 'string') {
				$scope.fabric.setText(newVal);
				$scope.fabric.render();
			}
		});

		$scope.$watch('fabric.selectedObject.fontSize', function(newVal) {
			if (typeof newVal === 'string' || typeof newVal === 'number') {
				$scope.fabric.setFontSize(newVal);
				$scope.fabric.render();
			}
		});

		$scope.$watch('fabric.selectedObject.lineHeight', function(newVal) {
			if (typeof newVal === 'string' || typeof newVal === 'number') {
				$scope.fabric.setLineHeight(newVal);
				$scope.fabric.render();
			}
		});

		$scope.$watch('fabric.selectedObject.textAlign', function(newVal) {
			if (typeof newVal === 'string') {
				$scope.fabric.setTextAlign(newVal);
				$scope.fabric.render();
			}
		});

		$scope.$watch('fabric.selectedObject.fontFamily', function(newVal) {
			if (typeof newVal === 'string' && newVal) {
				$scope.fabric.setFontFamily(newVal);
				$scope.fabric.render();
			}
		});

		$scope.$watch('fabric.selectedObject.opacity', function(newVal) {
			if (typeof newVal === 'string' || typeof newVal === 'number') {
				$scope.fabric.setOpacity(newVal);
				$scope.fabric.render();
			}
		});

		$scope.$watch('fabric.selectedObject.fill', function(newVal) {
			if (typeof newVal === 'string') {
				$scope.fabric.setFill(newVal);
				$scope.fabric.render();
			}
		});

		$scope.$watch('fabric.selectedObject.tint', function(newVal) {
			if (typeof newVal === 'string') {
				$scope.fabric.setTint(newVal);
				$scope.fabric.render();
			}
		});
	};

	$timeout(controller, 0);
}
angular.module('common.fabric.dirtyStatus', [])

.service('FabricDirtyStatus', ['$window', function($window) {
	'use strict';

	var self = {
		dirty: false
	};

	function checkSaveStatus() {
		if (self.isDirty()) {
			return 'Oops! You have unsaved changes.\n\n' +
				'Please save before leaving so you don\'t lose any work.';
		}
	}

	self.endListening = function() {
		$window.onbeforeunload = null;
		$window.onhashchange = null;
	};

	self.startListening = function() {
		$window.onbeforeunload = checkSaveStatus;
		$window.onhashchange = checkSaveStatus;
	};

	self.isDirty = function() {
		return self.dirty;
	};

	self.setDirty = function(value) {
		self.dirty = value;
	};

	return self;

}]);

angular
    .module('common.fabric.utilities', [])
    .directive('parentClick', ['$timeout', function($timeout) {
        'use strict';

        return {
            scope: {
                parentClick: '&'
            },
            link: function(scope, element) {
                element.mousedown(function() {
                    $timeout(function() {
                        scope.parentClick();
                    });
                })
                .children()
                .mousedown(function(e) {
                    e.stopPropagation();
                });
            }
        };
    }])
    .factory('Keypress', [function() {
        'use strict';

        var self = {};

        self.onKeyDown = function (listenerArea, callback) {
            listenerArea.addEventListener('keydown', function (event) {
                callback(event);
            }, false);
        };

        self.onKeyCode = function (listenerArea, keyCode, callback) {
            self.onKeyDown(listenerArea, function (event) {
                if (event.which === keyCode) {
                    event.preventDefault();
                    callback(event);
                }
            });
        };

        self.onCtrlAndS = function(callback) {
            self.onKeyDown(document, function (event) {
                if((event.ctrlKey || event.metaKey) && event.which === 83) {
                    event.preventDefault();
                    callback(event);
                }
            });
        };

        return self;
    }])
    .filter('Reverse', [function () {
        'use strict';
        
        return function(items) {
            if (items) {
                return items.slice().reverse();
            }
        };
    }])
    .filter('ArrayContainsProperty', [function () {
        'use strict';

        return function (objectArray, targetValue, property) {
            return objectArray.some(function (object) {
                if (!!object && !!object[property]) {
                    return object[property] === targetValue;
                }
                return false;
            });
        };
    }]);

angular.module('common.fabric.window', [])

.factory('FabricWindow', ['$window', function($window) {
	'use strict';

	return $window.fabric;

}]);
