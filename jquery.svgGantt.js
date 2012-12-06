;(function ( $, window, document, undefined ) {
  // Create the defaults once
  var pluginName = "svgGantt",
      defaults = {
        currentDate: null,
        grid: { color: "#DDD", offsetY: 0 },
        mode: "regular",
        modes: {
          regular: { scale: 2, paddingY: 1, showContent: true },
          collapsed: { scale: .3, paddingY: .2, showContent: false }
        },
        view: "month",
        views: {
          week: { gridX: 150, gridY: 12, format: "MMM, DD", labelEvery: "day" },
          month: { gridX: 42, gridY: 12, format: "MMM, DD", labelEvery: "day" },
          year: { gridX: 13, gridY: 12, format: "MMM", labelEvery: "month" }
        }
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
      var sg = this, options = sg.options;

      sg.sortObjects();
      sg.createUI(); // Create the UI elements (labels, content, grid)
      sg.createEvents(); // Create the UI elements (labels, content, grid)
      sg.drawGrid(); // Draw the grid background
      sg.setTimePosition(); // Determine the current position in time
      sg.drawLabels(); // Draw the date labels
      sg.dragInit(); // Initialize the ability to drag
      sg.createElements(); // Loop through the objects and create elements
      sg.arrangeElements(); // Arrange those elements by start date
    },

    sortObjects: function() {
      var sg = this;

      for(i=0;i<sg.objects.length;i++) {
        object = sg.objects[i];
        object.startDate = moment(object.startDate).unix();
        object.endDate = moment(object.endDate).unix();
      }
      this.objects.sort(function(a,b) { return a.startDate - b.startDate } );
      console.log(this.objects)
    },

    createUI: function() {
      var sg = this, options = sg.options,
          $container = sg.container;

      // Clear the container
      $container.html("").css({overflow: "hidden"});

      // Create the label container
      $('<div class="sg-labels"></div>').appendTo($container);
      sg.labels = $container.find(".sg-labels");

      // Create the content element
      $('<div class="sg-content"></div>').appendTo($container);
      sg.content = $container.find(".sg-content");

      // Create the canvas element for the grid
      $('<canvas class="sg-grid"></canvas>').appendTo($container).hide();
      sg.grid = $container.find(".sg-grid");
    },

    createEvents: function() {
      var sg = this, options = sg.options,
          $container = sg.container;

      // Change the current view
      $container.off("gantt-changeView").on("gantt-changeView", function(e, view) {
        options.view = view;
        sg.init();
      });

      // Change the current view
      $container.off("gantt-collapse").on("gantt-collapse", function() {
        if(options.mode === "collapsed") {
          options.mode = "regular";
        } else {
          options.mode = "collapsed";
        }
        sg.init();
      });
    },

    drawGrid: function() {
      var sg = this, options = this.options,
          canvas = sg.grid[0],
          ctx = canvas.getContext("2d"),
          view = options.views[options.view],
          gridX = view.gridX,
          gridY = view.gridY;

      // Create a canvas that fits the rectangle
      canvas.height = gridY;
      canvas.width = gridX;

      // Draw the grid image
      ctx.moveTo(gridX - 0.5, -0.5);
      ctx.lineTo(gridX - 0.5, gridY - 0.5);
      ctx.lineTo(-0.5,gridY - 0.5);
      ctx.strokeStyle = options.grid.color;
      ctx.stroke();

      // Create a repeated image from canvas
      data = canvas.toDataURL("image/jpg");
      sg.content.css({ background: "url("+data+")" });
    },

    setTimePosition: function() {
      var sg = this, options = sg.options,
          view = options.views[options.view],
          $container = sg.container,

          // Show dates according to width of container
          containerWidth = $container.width(),
          gridWidth = containerWidth * 3,
          gridX = view.gridX,
          contentOffset = -(Math.floor(containerWidth / gridX) * gridX),

          // Determine the current date
          currentDate = options.currentDate,
          today = currentDate ? moment(currentDate) : moment();

      // Set up our time constraints
      sg.startMoment = today.subtract("days", Math.floor(containerWidth / gridX));
      sg.daysInGrid = gridWidth / gridX;

      // Set the content to be within our time constraints
      sg.content.css({
        height: $container.height() * 2,
        marginLeft: contentOffset,
        position: "relative",
        marginTop: options.grid.offsetY,
        width: gridWidth
      })

      // Set the labels to be within our time constraints
      sg.labels.css({
        left: contentOffset,
        width: gridWidth
      })
    },

    drawLabels: function() {
      var sg = this, options = sg.options,
          view = options.views[options.view],
          daysInGrid = sg.daysInGrid,
          gridX = view.gridX;

      for(var i=0;i<daysInGrid;i++) {
        var curMoment = moment(sg.startMoment).add("days", i),
            addLabel = false;

        if(view.labelEvery === "month") {
          if(curMoment.format("D") === "1") { addLabel = true; }
        } else {
          // Every day
          addLabel = true;
        }

        if(addLabel) {
          // Create the label
          var label = curMoment.format(view.format),
              $label = $('<div class="sg-label"><div class="sg-'+options.view+'">'+label+'</div></div>');

          // Append it and position
          sg.labels.append($label);
          $label.css({
            left: gridX * i,
            position: "absolute",
            textAlign: "center",
            top: 5,
            width: gridX
          })
        }
      }
    },

    dragInit: function() {
      var sg = this, options = sg.options,
          mouse = container = {x: 0, y: 0},
          dragging = false,
          gridX = options.views[options.view].gridX,
          $content = sg.content,
          startMoment = curMoment = null,
          maxHeight = 0;

      $content.off().on("mousedown mousemove mouseup", function(e) {
        if(e.type === "mousedown") {
          // Turn on dragging and record the initial position
          dragging = true;
          mouse = {x: e.pageX, y: e.pageY}
          container = {
            x: parseInt($content.css("margin-left")),
            y: parseInt($content.css("margin-top"))
          }
          curDayOffset = Math.round(parseInt($content.css("margin-left")) / gridX);
          startMoment = moment(sg.startMoment).subtract("days", curDayOffset);
          maxHeight = $content.height() / 2;
        } else if(e.type === "mousemove" && dragging) {
          // Determine the new content position based on
          // the mouse offset vs the original container position
          marginLeft = container.x + (e.pageX - mouse.x)
          marginTop = container.y + (e.pageY - mouse.y)

          // Prevent from scrolling outside of the content
          if(marginLeft > 0) { marginLeft = 0; }
          if(marginTop > 0) { marginTop = 0; }
          if(marginTop <= -(maxHeight)) { marginTop = -(maxHeight); }

          // Move the content
          $content.css({ marginLeft: marginLeft, marginTop: marginTop })
          sg.labels.css({ left: marginLeft })

        } else if(e.type === "mouseup") {
          // Turn off dragging
          dragging = false;

          // Find the currently selected day based on
          // the offset of the content
          curDayOffset = Math.round(parseInt($content.css("margin-left")) / gridX);
          curMoment = moment(sg.startMoment).subtract("days", curDayOffset);

          if(curMoment.format("MM DD") != startMoment.format("MM DD")) {
            // Set the new day as the current moment
            options.currentDate = curMoment;
            options.grid.offsetY = parseInt($content.css("margin-top"))
            sg.init();
          }
        }
      })
    },

    createElements: function() {
      var sg = this, options = sg.options,
          view = options.views[options.view],
          gridX = view.gridX,
          mode = options.modes[options.mode];

      for(i=0;i<sg.objects.length;i++) {
        var object = sg.objects[i],
            // Create the UI for the element
            $object = $('<div class="sg-object"></div>'),
            $img = $('<img class="sg-icon" src="'+object.iconURL+'" />'),
            $name = $('<div class="sg-name">'+object.name+'</div>'),

            // Determine the object date
            startDate = moment.unix(object.startDate),
            endDate = moment.unix(object.endDate),
            daysBetween = endDate.diff(startDate, "days") + 1,
            daysSinceStart = startDate.diff(sg.startMoment, "days"),

            // Determine the object properties from the dates
            height = view.gridY * mode.scale,
            width = daysBetween * gridX,
            left = daysSinceStart * gridX;

        // If the content is visible
        if(mode.showContent) { $object.append($img).append($name); }

        // Append the element to the content
        sg.content.append($object);
        $img.css({
          height: height,
          width: height
        })
        $name.css({
          width: width - $img.outerWidth(true)
        })
        $object.css({
          background: object.color,
          height: height,
          left: left,
          top: -30,
          width: width
        })
      }
    },

    arrangeElements: function(animated) {
      var sg = this, options = sg.options,
          mode = options.modes[options.mode],
          $objects = sg.content.children(),
          gridY = options.views[options.view].gridY,
          paddingY = gridY * mode.paddingY,
          objectHeight = gridY * mode.scale,
          objects = sg.objects;

      // Loop over each object
      for(var i=0;i<objects.length;i++) {
        // Get the date data for the current object
        var selected = sg.objects[i],
            selectedStart = selected.startDate,
            selectedEnd = selected.endDate,
            $selected = $($objects[i]),
            row = 0,
            usedRows = [];

        // TODO: Clean this up to prevent unecessary calculations
        // Loop over every object before this one
        for(var j=0;j<i;j++) {
          // Determine if this object is within the range of the
          // currently selected one.
          var object = objects[j],
              objectStart = object.startDate,
              objectEnd = object.endDate,
              betweenObjectStart = sg.isBetween(objectStart, selectedStart, objectEnd),
              betweenObjectEnd = sg.isBetween(objectStart, selectedEnd, objectEnd),
              betweenSelectedStart = sg.isBetween(selectedStart, objectStart, selectedEnd),
              betweenSelectedEnd = sg.isBetween(selectedStart, objectEnd, selectedEnd);

          if(!object.ganttRow) {object.ganttRow = 0}
          // If it is, then we must move it down a row to compensate
          if(betweenObjectStart || betweenObjectEnd || betweenSelectedStart || betweenSelectedEnd) {
            usedRows.push(object.ganttRow)
          }
        }

        usedRows.sort(function(a,b) { return a-b });
        for(k=0;k<usedRows.length;k++) {
          usedRow = usedRows[k];
          if(row === usedRow) {
            row++;
          }
        }

        selected.ganttRow = row;

        // Set the vertical offset
        attributes = { top: paddingY + (row * (objectHeight + paddingY)) }
        if(animated) {
          $selected.animate(attributes)
        } else {
          $selected.css(attributes)
        }
      }
    },

    // Helper functions
    isBetween: function(first, middle, last) {
      return (first < last ? middle >= first && middle <= last : middle >= last && middle <= first);
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