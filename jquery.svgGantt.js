;(function ( $, window, document, undefined ) {
  // Create the defaults once
  var pluginName = "svgGantt",
      defaults = {
        currentDate: null,
        grid: { color: "#DDD", offsetY: 0 },
        mode: "regular",
        modes: {
          regular: { scale: 2, paddingX: 2, paddingY: 1, showContent: true },
          collapsed: { scale: .3, paddingX: 0, paddingY: .3, showContent: false }
        },
        view: "month",
        views: {
          week: { gridX: 150, gridY: 10, format: "MMM, DD", labelEvery: "day", timelinePadding: 600 },
          month: { gridX: 42, gridY: 10, format: "MMM, DD", labelEvery: "day", timelinePadding: 600 },
          year: { gridX: 13, gridY: 10, format: "MMM", labelEvery: "month", timelinePadding: 600 }
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
      var sg = this;

      // One time calculations
      sg.parseObjects(); // Modify initial object data
      sg.createUI(); // Create the UI elements (labels, content, grid)
      sg.render(); // Render the actual content
    },

    render: function() {
      var sg = this;

      console.time("render time")
      sg.clearUI(); // Clear any data from last render
      sg.setTimeframe(); // Determine where in time we are
      sg.setActiveObjects(); // Only get the objects in the current timeframe

      // Physical Application
      sg.drawGrid(); // Draw the grid background
      sg.setPosition(); // Determine the current visual position in time
      sg.drawLabels(); // Draw the date labels
      sg.createElements(); // Loop through the objects and create elements
      sg.arrangeElements(); // Arrange those elements by start date

      // Interactions
      sg.dragInit(); // Initialize the ability to drag
      sg.createEvents(); // Create the UI elements (labels, content, grid)
      console.timeEnd("render time")
    },

    parseObjects: function() {
      var sg = this,
          objects = sg.objects;

      // Go over each object and modify the data.
      for(i=0;i<objects.length;i++) {
        var object = objects[i];

        // Convert to Unix time.
        if(isNaN(object.startDate)) {
          object.startDate = moment(object.startDate).unix();
          object.endDate = moment(object.endDate).unix();
        }
      }

      // Sort them by their start time / ID
      objects.sort(function(a,b) {
        isBefore = a.startDate - b.startDate;
        if(!isBefore) { isBefore = a.id - b.id }
        return isBefore
      });
    },

    createUI: function() {
      var sg = this, options = sg.options,
          $container = sg.container;

      $container.css({overflow: "hidden"});

      // Create the label container
      $('<div>').addClass("sg-labels").appendTo($container);
      sg.labels = $container.find(".sg-labels");

      // Create the content element
      $('<div>').addClass("sg-content").appendTo($container);
      sg.content = $container.find(".sg-content");

      // Create the canvas element for the grid
      $('<canvas>').addClass("sg-grid").appendTo($container).hide();
      sg.grid = $container.find(".sg-grid");
    },

    clearUI: function() {
      var sg = this;

      sg.content.html("");
      sg.labels.html("");
    },

    setTimeframe: function() {
      var sg = this, options = sg.options,
          $container = sg.container,
          currentDate = options.currentDate,

          // The timeframe is calculated by the width of the container
          containerWidth = $container.width(),
          gridWidth = containerWidth * 3,
          gridX = options.views[options.view].gridX;


      // Set up our time constraints
      sg.curMoment = currentDate ? moment(currentDate) : moment();
      sg.daysInGrid = Math.floor(gridWidth / gridX);
      sg.startMoment = moment(sg.curMoment).subtract("days", Math.floor(containerWidth / gridX));
      sg.endMoment = moment(sg.startMoment).add("days", sg.daysInGrid);
    },

    setActiveObjects: function() {
      var sg = this, options = sg.options,
          view = options.views[options.view],
          objects = sg.objects;

      // Set the live objects to only be those that are in view
      sg.activeObjects = [];
      var timelinePadding = (view.timelinePadding * 24*60*60),
          timelineStart = sg.startMoment.unix() - timelinePadding,
          timelineEnd = moment(sg.startMoment).add("days", sg.daysInGrid).unix() + timelinePadding;

      // Determine if the object falls in between the current time frame
      for(i=0;i<objects.length;i++) {
        var object = objects[i],
            isBetweenStart = sg.isBetween(timelineStart,object.startDate,timelineEnd),
            isBetweenEnd = sg.isBetween(timelineStart,object.endDate,timelineEnd);
        if(isBetweenStart || isBetweenEnd) {
          object.ganttRow = 0;
          sg.activeObjects.push(object);
        }
      }
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

    setPosition: function() {
      var sg = this, options = sg.options,
          $container = sg.container,
          containerWidth = $container.width(),
          view = options.views[options.view],
          gridX = view.gridX,
          gridWidth = containerWidth * 3,
          contentOffset = -(Math.floor(containerWidth / gridX) * gridX);

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

      sg.labels.html("")

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

    createElements: function() {
      var sg = this, options = sg.options,
          mode = options.modes[options.mode],
          view = options.views[options.view],
          gridX = view.gridX,
          objects = sg.activeObjects,
          elements = []
          el_i = 0,
          el_height = view.gridY * mode.scale;

      for(i=0;i<objects.length;i++) {
        var object = objects[i],

            // Determine the object date
            startDate = moment.unix(object.startDate),
            endDate = moment.unix(object.endDate),
            daysBetween = endDate.diff(startDate, "days") + 1,
            daysSinceStart = startDate.diff(sg.startMoment, "days"),

            // Element Attributes
            width = daysBetween * gridX,
            left = daysSinceStart * gridX,

            // Physical object element
            element = '<div class="sg-object" style="'+
                      'height:'+el_height+'px;'+
                      'left:'+left+'px;'+
                      'top: -30px;'+
                      'width:'+width+'px;">';

            element += '<div class="sg-data" style="'+
                        'background:'+object.color+';'+
                        'height:'+el_height+'px;'+
                        'width:'+width+'px;">';

            // If the object content is visible
            if(mode.showContent) {
              // The image icon
              element += '<img class="sg-icon" '+
                          'src="'+object.iconURL+'" style="'+
                          'height: '+el_height+';'+
                          'width: '+el_height+';" />';

              // The name
              element += '<div class="sg-name" style="'+
                          'width: '+(width - el_height - 8)+'px;">'+
                          object.name + "</div>";

              // The moments
              element += '<div class="sg-moments">';

              for(j=0;j<object.moments.length;j++) {
                var objMoment = object.moments[j],
                    left = moment(startDate).diff(objMoment.date, "days") * gridX;
                element += '<div class="sg-moment" style="'+
                            'left: '+left+'px;"></div>'
              }

              element += '</div></div>'; // Close sg-moments
            } else {
              element += "</div>"; // Close sg-data
            }
            element += "</div>"; // Close sg-object

        elements[el_i++] = element;
      }
      sg.content.append(elements.join(''));
    },

    arrangeElements: function(animated) {
      var sg = this, options = sg.options,
          mode = options.modes[options.mode],
          $objects = sg.content.children(),
          gridY = options.views[options.view].gridY,
          paddingY = gridY * mode.paddingY,
          paddingX = mode.paddingX * (24*60*60),
          objectHeight = gridY * mode.scale,
          objects = sg.activeObjects;

      // Loop over each object
      for(var i=0;i<objects.length;i++) {
        // Get the date data for the current object
        var selected = objects[i],
            selectedStart = selected.startDate - paddingX,
            selectedEnd = selected.endDate + paddingX,
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

          // If it is, then we must move it down a row to compensate
          if(betweenObjectStart || betweenObjectEnd || betweenSelectedStart || betweenSelectedEnd) {
            usedRows.push(object.ganttRow);
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
        attributes = {
          top: paddingY + (row * (objectHeight + paddingY)),
          zIndex: 5000 - (row * 10)
        }
        if(animated) {
          $selected.animate(attributes)
        } else {
          $selected.css(attributes)
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
            options.grid.offsetY = parseInt($content.css("margin-top"));
            sg.render();
          }
        }
      })
    },

    createEvents: function() {
      var sg = this, options = sg.options,
          $container = sg.container;

      // Change the current view
      $container.off("gantt-changeView").on("gantt-changeView", function(e, view) {
        options.view = view;
        sg.render();
      });

      // Change the current view
      $container.off("gantt-collapse").on("gantt-collapse", function() {
        if(options.mode === "collapsed") {
          options.mode = "regular";
        } else {
          options.mode = "collapsed";
        }
        sg.render();
      });
    },

    // Helper functions
    isBetween: function(first, middle, last) {
      return (first <= middle && middle <= last);
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