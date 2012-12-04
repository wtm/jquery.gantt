;(function ( $, window, document, undefined ) {
  // Create the defaults once
  var pluginName = "svgGantt",
      defaults = {
        startTime: null,
        view: "week",
        gridColor: "#F0F0F0"
      };

  function svgGantt( element, options ) {
    var sg = this;
    sg.container = $(element);
    sg.svg = null;
    sg.grid = null;
    sg.options = $.extend( {}, defaults, options );
    sg.init();
  }

  svgGantt.prototype = {

    init: function() {
      var sg = this;
      sg.setup();
      sg.drawGrid();
      sg.setPosition();
      sg.dragInit();
    },

    setup: function() {
      var sg = this;

      // Create the SVG element
      $('<svg class="svgGantt"></svg>').appendTo(sg.container);
      sg.svg = sg.container.find(".svgGantt");

      // Create the canvas element for the grid
      $('<canvas class="grid"></canvas>').appendTo(sg.container).hide();
      sg.grid = sg.container.find(".grid");

      // Create the data for each view type
      sg.views = {
        week: {
          gridX: 150,
          gridY: 10
        },
        month: {
          gridX: 50,
          gridY: 10
        },
        year: {
          gridX: 10,
          gridY: 10
        }
      }
    },

    setPosition: function() {
      var sg = this,
          options = sg.options,
          containerWidth = sg.container.width(),
          gridX = sg.views[options.view].gridX;

      sg.svg.css({
        height: 500,
        marginLeft: -(Math.round(containerWidth / gridX) * gridX),
        position: "relative",
        width: containerWidth * 3
      })
    },

    drawGrid: function() {
       var sg = this,
          options = this.options,
          canvas = sg.grid[0],
          ctx = canvas.getContext("2d"),
          view = sg.views[options.view],
          scaleX = view.gridX,
          scaleY = view.gridY;

      canvas.height = scaleY;
      canvas.width = scaleX;

      // Draw the grid image
      ctx.moveTo(scaleX - 0.5, -0.5);
      ctx.lineTo(scaleX - 0.5, scaleY - 0.5);
      ctx.lineTo(-0.5,scaleY - 0.5);
      ctx.strokeStyle = options.gridColor;
      ctx.stroke();

      // Create a repeated image from canvas
      data = canvas.toDataURL("image/jpg");
      sg.svg.css({ background: "url("+data+")" });
    },

    dragInit: function() {
      var sg = this,
          options = sg.options,
          mouse = container = {x: 0, y: 0},
          dragging = false;

      sg.svg.on("mousedown mousemove mouseup", function(e) {
        if(e.type === "mousedown") {
          dragging = true;
          mouse = {x: e.pageX, y: e.pageY}
          container = {x: parseInt(sg.svg.css("margin-left")), y: parseInt(sg.svg.css("margin-top"))}
        } else if(e.type === "mousemove" && dragging) {
          xDiff = -(e.pageX - mouse.x);
          yDiff = -(e.pageY - mouse.y);

          marginLeft = container.x - xDiff
          marginTop = container.y - yDiff

          if(marginLeft > 0) { marginLeft = 0; }
          if(marginTop > 0) { marginTop = 0; }

          sg.svg.css({
            marginLeft: marginLeft,
            marginTop: marginTop
          })
        } else if(e.type === "mouseup") {
          dragging = false;
        }
      })
    }

  };

  // A really lightweight plugin wrapper around the constructor,
  // preventing against multiple instantiations
  $.fn[pluginName] = function ( options ) {
    return this.each(function () {
      if (!$.data(this, "plugin_" + pluginName)) {
        $.data(this, "plugin_" + pluginName, new svgGantt( this, options ));
      }
    });
  };

})( jQuery, window, document );