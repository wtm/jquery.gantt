;(function ( $, window, document, undefined ) {
  // Create the defaults once
  var pluginName = "svgGantt",
      defaults = {
        gridColor: "#F0F0F0",
        startDate: null,
        view: "week"
      };

  function svgGantt( element, objects, options ) {
    var sg = this;
    sg.container = $(element);
    sg.options = $.extend( {}, defaults, options );
    sg.objects = objects;
    sg.init();
  }

  svgGantt.prototype = {

    init: function() {
      var sg = this;
      sg.setup();
      sg.setTimePosition();
      sg.drawGrid();
      sg.drawLabels();
      sg.dragInit();
      sg.createElements();
    },

    setup: function() {
      var sg = this,
          options = sg.options;

      // Clear the container
      sg.container.html("");

      // Create the label container
      $('<div class="sg-labels"></div>').appendTo(sg.container);
      sg.labels = sg.container.find(".sg-labels");

      // Create the content element
      $('<div class="sg-content"></div>').appendTo(sg.container);
      sg.content = sg.container.find(".sg-content");

      // Create the canvas element for the grid
      $('<canvas class="sg-grid"></canvas>').appendTo(sg.container).hide();
      sg.grid = sg.container.find(".sg-grid");

      // Create the data for each view type
      sg.views = {
        week: {
          gridX: 150,
          gridY: 10,
          format: "MMM, DD"
        },
        month: {
          gridX: 50,
          gridY: 10,
          format: "MMM, DD"
        },
        year: {
          gridX: 10,
          gridY: 10,
          format: "MMM"
        }
      }
    },

    setTimePosition: function() {
      var sg = this,
          options = sg.options,
          containerWidth = sg.container.width(),
          gridWidth = containerWidth * 3,
          gridX = sg.views[options.view].gridX,
          contentOffset = -(Math.floor(containerWidth / gridX) * gridX);

      today = options.startDate ? moment(options.startDate) : moment();

      // Set up our time constraints
      sg.startMoment = today.subtract("days", Math.floor(containerWidth / gridX));
      sg.daysInGrid = gridWidth / gridX;

      // Set the content to be within our time constraints
      sg.content.css({
        height: 500,
        marginLeft: contentOffset,
        position: "relative",
        width: gridWidth
      })

      sg.labels.css({
        left: contentOffset,
        width: gridWidth
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
      sg.content.css({ background: "url("+data+")" });
    },

    drawLabels: function() {
      var sg = this,
          options = sg.options,
          daysInGrid = sg.daysInGrid,
          gridX = sg.views[options.view].gridX;

      for(var i=0;i<daysInGrid;i++) {
        var label = moment(sg.startMoment).add("days", i).format(sg.views[options.view].format),
            $label = $('<div class="sg-label"><div class="sg-'+options.view+'">'+label+'</div></div>');
        sg.labels.append($label);
        $label.css({
          left: gridX * i,
          position: "absolute",
          textAlign: "center",
          top: 5,
          width: gridX
        })
      }
    },

    dragInit: function() {
      var sg = this,
          options = sg.options,
          mouse = container = {x: 0, y: 0},
          dragging = false,
          gridX = sg.views[options.view].gridX;

      sg.content.off().on("mousedown mousemove mouseup", function(e) {
        if(e.type === "mousedown") {
          dragging = true;
          mouse = {x: e.pageX, y: e.pageY}
          container = {x: parseInt(sg.content.css("margin-left")), y: parseInt(sg.content.css("margin-top"))}
        } else if(e.type === "mousemove" && dragging) {
          marginLeft = container.x + (e.pageX - mouse.x)
          marginTop = container.y + (e.pageY - mouse.y)

          if(marginLeft > 0) { marginLeft = 0; }
          if(marginTop > 0) { marginTop = 0; }

          sg.content.css({
            marginLeft: marginLeft,
            marginTop: marginTop
          })
          sg.labels.css({
            left: marginLeft
          })
        } else if(e.type === "mouseup") {
          dragging = false;

          curDayOffset = parseInt(sg.content.css("margin-left")) / gridX;
          curMoment = moment(sg.startMoment).subtract("days", curDayOffset);
          options.startDate = curMoment;
          sg.init();
        }
      })
    },

    createElements: function() {
      var sg = this,
          options = sg.options,
          gridX = sg.views[options.view].gridX,
          gridY = sg.views[options.view].gridY,
          paddingX = gridY;
      console.log(sg.labels.height())

      for(i=0;i<sg.objects.length;i++) {
        var object = sg.objects[i],
            $object = $('<div class="sg-object"></div>'),
            $img = $('<img class="sg-icon" src="'+object.iconURL+'" />').appendTo($object),
            $name = $('<div class="sg-name">'+object.name+'</div>').appendTo($object),
            startDate = moment(object.startDate),
            endDate = moment(object.endDate),
            daysBetween = endDate.diff(startDate, "days") + 1,
            daysSinceStart = startDate.diff(sg.startMoment, "days") + 1;

        sg.content.append($object);

        $object.css({
          background: object.color,
          height: gridY * 2,
          left: daysSinceStart * gridX,
          top: paddingX,
          width: daysBetween * gridX
        })
      }
    }

  };

  // A really lightweight plugin wrapper around the constructor,
  // preventing against multiple instantiations
  $.fn[pluginName] = function ( objects, options ) {
    return this.each(function () {
      if (!$.data(this, "plugin_" + pluginName)) {
        $.data(this, "plugin_" + pluginName, new svgGantt( this, objects, options ));
      }
    });
  };

})( jQuery, window, document );