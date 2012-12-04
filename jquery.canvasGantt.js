;(function ( $, window, document, undefined ) {
  var pluginName = "canvasGantt",
      defaults = {
        propertyName: "value"
      };

  function canvasGantt( element, options ) {
    this.element = element;
    this.options = $.extend( {}, defaults, options );
    this._defaults = defaults;
    this._name = pluginName;
    this.init();
  }

  canvasGantt.prototype = {
    init: function() {
      console.log("init");
    }
  };

  $.fn[pluginName] = function ( options ) {
    return this.each(function () {
      if (!$.data(this, "plugin_" + pluginName)) {
        $.data(this, "plugin_" + pluginName, new canvasGantt( this, options ));
      }
    });
  };
})( jQuery, window, document );