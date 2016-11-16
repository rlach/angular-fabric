angular.module('common.fabric.utilities', [])

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

.filter('ArrayContainsName', [function () {
	'use strict';

	return function (objectArray, targetName, caseSensitive) {
		return objectArray.some(function (object) {
			if (!!object.name) {
				return !!caseSensitive ?
					object.name.toLowerCase() === targetName.toLowerCase() :
					object.name === targetName;
			}
		});
	};
}]);
