angular.module('common.fabric.directive', [
	'common.fabric.canvas'
])

.directive('fabric', ['$timeout', 'FabricCanvas', '$window', function($timeout, FabricCanvas, $window) {

	return {
		scope: {
			fabric: '='
		},
		controller: DirectiveController
	};

}]);

DirectiveController.$inject = ['$scope', '$element'];

function DirectiveController($scope, $element) {
			FabricCanvas.setElement($element);
			FabricCanvas.createCanvas();

			// Continue rendering the canvas until the user clicks
			// to avoid the "calcOffset" bug upon load.
			$('body').on('click', 'canvas', function() {
				if (fabric.setUserHasClickedCanvas) {
					fabric.setUserHasClickedCanvas(true);
				}
			});

			//
			// Watching Controller Variables
			// ============================================================
			$scope.$watch('fabric.canvasBackgroundColor', function(newVal) {
				if (fabric.setCanvasBackgroundColor) {
					fabric.setCanvasBackgroundColor(newVal);
				}
			});

			$scope.$watch('fabric.selectedObject.text', function(newVal) {
				if (typeof newVal === 'string') {
					fabric.setText(newVal);
					fabric.render();
				}
			});

			$scope.$watch('fabric.selectedObject.fontSize', function(newVal) {
				if (typeof newVal === 'string' || typeof newVal === 'number') {
					fabric.setFontSize(newVal);
					fabric.render();
				}
			});

			$scope.$watch('fabric.selectedObject.lineHeight', function(newVal) {
				if (typeof newVal === 'string' || typeof newVal === 'number') {
					fabric.setLineHeight(newVal);
					fabric.render();
				}
			});

			$scope.$watch('fabric.selectedObject.textAlign', function(newVal) {
				if (typeof newVal === 'string') {
					fabric.setTextAlign(newVal);
					fabric.render();
				}
			});

			$scope.$watch('fabric.selectedObject.fontFamily', function(newVal) {
				if (typeof newVal === 'string' && newVal) {
					fabric.setFontFamily(newVal);
					fabric.render();
				}
			});

			$scope.$watch('fabric.selectedObject.opacity', function(newVal) {
				if (typeof newVal === 'string' || typeof newVal === 'number') {
					fabric.setOpacity(newVal);
					fabric.render();
				}
			});

			$scope.$watch('fabric.selectedObject.fill', function(newVal) {
				if (typeof newVal === 'string') {
					fabric.setFill(newVal);
					fabric.render();
				}
			});

			$scope.$watch('fabric.selectedObject.tint', function(newVal) {
				if (typeof newVal === 'string') {
					fabric.setTint(newVal);
					fabric.render();
				}
			});
		}