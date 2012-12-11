;(function ( $, window, document, undefined ) {
  // Create the defaults once
  var pluginName = "svgGantt",
      defaults = {
        mode: "regular",
        modes: {
          regular: { scale: 2, paddingX: 2, paddingY: 1, showContent: true },
          collapsed: { scale: .3, paddingX: 0, paddingY: .3, showContent: false }
        },
        position: { date: null, top: 0 },
        view: "month",
        views: {
          week: {
            grid: { color: "#DDD", x: 150, y: 10 },
            format: "MMM, DD", labelEvery: "day", preloadDays: 150 },
          month: {
            grid: { color: "#DDD", x: 42, y: 10 },
            format: "MMM, DD", labelEvery: "day", preloadDays: 150 },
          year: {
            grid: { color: "#DDD", x: 13, y: 10 },
            format: "MMM", labelEvery: "month", preloadDays: 150 }
        }
      };

  function svgGantt( element, projects, options ) {
    var sg = this;
    sg.container = $(element);
    sg.options = $.extend( {}, defaults, options );
    sg.projects = projects;
    sg.init();
  }

  svgGantt.prototype = {

    init: function() {
      var sg = this;

      // One time calculations
      sg.parseProjects(); // Modify initial project data
      sg.createUI(); // Create the UI elements (labels, content, grid)
      sg.render(); // Render the actual content
    },

    render: function() {
      var sg = this;

      console.time("render time")
      sg.clearUI(); // Clear any data from last render
      sg.setTimeframe(); // Determine where in time we are
      sg.setActiveProjects(); // Only get the projects in the current timeframe

      // Physical Application
      sg.drawGrid(); // Draw the grid background
      sg.setPosition(); // Determine the current visual position in time
      sg.drawLabels(); // Draw the date labels
      sg.createElements(); // Loop through the projects and create elements
      sg.arrangeElements(); // Arrange those elements by start date

      // Interactions
      sg.dragInit(); // Initialize the ability to drag
      sg.createEvents(); // Create the UI elements (labels, content, grid)
      console.timeEnd("render time")
    },

    parseProjects: function() {
      var sg = this,
          projects = sg.projects,
          project = null;

      for(i=0;i<projects.length;i++) {
        project = projects[i];

        // Convert to Unix time.
        if(isNaN(project.startDate)) {
          project.startDate = moment(project.startDate).unix();
          project.endDate = moment(project.endDate).unix();
        }
      }

      // Sort them by their start time / ID
      projects.sort(function(a,b) {
        return a.startDate - b.startDate;
      });
    },

    createUI: function() {
      var sg = this,
          $container = sg.container,
          elements = '';

      elements =  '<div class="sg-viewport">' +
                    '<div class="sg-timeline">' +
                      '<div class="sg-labels"></div>' +
                      '<div class="sg-content"></div>' +
                    '</div>' +
                    '<canvas class="sg-grid"></canvas>' +
                  '</div>';

      // Append the elements
      $container.append(elements);

      // Create jQuery elements
      sg.labels = $container.find(".sg-labels");
      sg.content = $container.find(".sg-content");
      sg.timeline = $container.find(".sg-timeline")
      sg.viewport = $container.find(".sg-viewport")
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
          date = options.position.date,

          // The timeframe is calculated by the width of the container
          containerWidth = $container.width(),
          gridWidth = containerWidth * 3,
          gridX = options.views[options.view].grid.x;

      // Set up our time variables / constraints
      sg.curMoment = date ? moment(date) : moment();
      sg.daysInGrid = Math.floor(gridWidth / gridX);
      sg.startMoment = moment(sg.curMoment).subtract("days", Math.floor(containerWidth / gridX));
      sg.endMoment = moment(sg.startMoment).add("days", sg.daysInGrid);
    },

    setActiveProjects: function() {
      var sg = this, options = sg.options,
          view = options.views[options.view],
          projects = sg.projects;

      // Set the live projects to only be those that are in view
      var preloadDays = (view.preloadDays * 24*60*60),
          timelineStart = sg.startMoment.unix() - preloadDays,
          timelineEnd = moment(sg.startMoment).add("days", sg.daysInGrid).unix() + preloadDays;

      // Clear the current active projects
      sg.activeProjects = [];
      // Determine if the project falls in between the current time frame
      for(i=0;i<projects.length;i++) {
        var project = projects[i],
            isBetweenStart = sg.isBetween(timelineStart,project.startDate,timelineEnd),
            isBetweenEnd = sg.isBetween(timelineStart,project.endDate,timelineEnd);
        if(isBetweenStart || isBetweenEnd) {
          project.ganttRow = 0;
          sg.activeProjects.push(project);
        }
      }
    },

    drawGrid: function() {
      var sg = this, options = this.options,
          canvas = sg.grid[0],
          ctx = canvas.getContext("2d"),
          view = options.views[options.view],
          gridX = view.grid.x,
          gridY = view.grid.y;

      // Create a canvas that fits the rectangle
      canvas.height = gridY;
      canvas.width = gridX;

      // Draw the grid image
      ctx.moveTo(gridX - 0.5, -0.5);
      ctx.lineTo(gridX - 0.5, gridY - 0.5);
      ctx.lineTo(-0.5,gridY - 0.5);
      ctx.strokeStyle = view.grid.color;
      ctx.stroke();

      // Create a repeated image from canvas
      data = canvas.toDataURL("image/jpg");
      sg.content.css({ background: "url("+data+")" });
    },

    setPosition: function() {
      var sg = this, options = sg.options,
          $container = sg.container,
          containerWidth = $container.width(),
          gridX = options.views[options.view].grid.x,
          gridWidth = containerWidth * 3,
          contentOffset = -(Math.floor(containerWidth / gridX) * gridX);

      sg.timeline.css({
        marginLeft: contentOffset,
        width: gridWidth
      })
    },

    drawLabels: function() {
      var sg = this, options = sg.options,
          view = options.views[options.view],
          gridX = view.grid.x,
          labels = [];

      for(var i=0;i<sg.daysInGrid;i++) {
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
          var name = curMoment.format(view.format),
              label = '<div class="sg-label" style="'+
                      'left:'+(gridX * i)+'px;'+
                      'width:'+gridX+'px;">'+
                      '<div class="sg-'+options.view+'">'+name+'</div></div>';

          labels.push(label);
        }
      }
      sg.labels.append(labels.join(''));
    },

    createElements: function() {
      var sg = this, options = sg.options,
          mode = options.modes[options.mode],
          view = options.views[options.view],
          gridX = view.grid.x,
          projects = sg.activeProjects,
          elements = []
          el_height = view.grid.y * mode.scale - 1;

      for(i=0;i<projects.length;i++) {
        var project = projects[i],

            // Determine the project date
            startDate = moment.unix(project.startDate),
            endDate = moment.unix(project.endDate),
            daysBetween = endDate.diff(startDate, "days") + 1,
            daysSinceStart = startDate.diff(sg.startMoment, "days"),

            // Element Attributes
            width = daysBetween * gridX - 2,
            left = daysSinceStart * gridX;

        // Physical project element
        elements.push('<div class="sg-project" style="'+
                  'height:'+el_height+'px;'+
                  'left:'+left+'px;'+
                  'top: -30px;'+
                  'width:'+width+'px;">');

        elements.push('<div class="sg-data" style="'+
                    'background:'+project.color+';'+
                    'height:'+el_height+'px;'+
                    'width:'+width+'px;">');

        // If the project content is visible
        if(mode.showContent) {
          // The image icon
          elements.push('<img class="sg-icon" '+
                      'src="'+project.iconURL+'" style="'+
                      'height: '+el_height+';'+
                      'width: '+el_height+';" />');

          // The name
          elements.push('<div class="sg-name" style="'+
                      'width: '+(width - el_height - 8)+'px;">'+
                      project.name + "</div>");

          // The tasks
          elements.push('<div class="sg-tasks">');

          for(j=0;j<project.tasks.length;j++) {
            var objMoment = project.tasks[j],
                left = moment(startDate).diff(objMoment.date, "days") * gridX;
            elements.push('<div class="sg-task" style="left:'+left+'px;"></div>')
          }

          elements.push('</div></div>'); // Close sg-tasks
        } else {
          elements.push("</div>"); // Close sg-data
        }
        elements.push("</div>"); // Close sg-project
      }

      // Append the elements
      sg.content.append(elements.join(''));
    },

    arrangeElements: function(animated) {
      var sg = this, options = sg.options,
          mode = options.modes[options.mode],
          $projects = sg.content.children(),
          gridY = options.views[options.view].grid.y,
          paddingY = gridY * mode.paddingY,
          paddingX = mode.paddingX * (24*60*60),
          projectHeight = gridY * mode.scale,
          projects = sg.activeProjects,
          maxRow = 0;

      // Loop over each project
      for(var i=0;i<projects.length;i++) {
        // Get the date data for the current project
        var selected = projects[i],
            selectedStart = selected.startDate - paddingX,
            selectedEnd = selected.endDate + paddingX,
            $selected = $($projects[i]),
            row = 0,
            usedRows = [];

        // Loop over every project before this one
        for(var j=0;j<i;j++) {
          var project = projects[j],
              projectStart = project.startDate,
              projectEnd = project.endDate;

          // Determine if this project is within the range of the
          // currently selected one.
          if(sg.isBetween(projectStart, selectedStart, projectEnd)) {
            usedRows.push(project.ganttRow);
          } else if(sg.isBetween(selectedStart, projectEnd, selectedEnd)) {
            usedRows.push(project.ganttRow);
          } else if(sg.isBetween(projectStart, selectedEnd, projectEnd)) {
            usedRows.push(project.ganttRow);
          } else if(sg.isBetween(selectedStart, projectStart, selectedEnd)) {
            usedRows.push(project.ganttRow);
          }
        }

        usedRows.sort(function(a,b) { return a-b });
        for(k=0;k<usedRows.length;k++) {
          usedRow = usedRows[k];
          if(row === usedRow) {
            row++;
          }
        }

        if(row > maxRow) {maxRow = row;}
        selected.ganttRow = row;

        // Set the vertical offset
        attributes = {
          top: paddingY + (row * (projectHeight + paddingY)) - 1,
          zIndex: 5000 - (row * 10)
        }
        if(animated) {
          $selected.animate(attributes)
        } else {
          $selected.css(attributes)
        }
      }

      // Set the content height
      maxRow++;
      height = (maxRow * gridY) + (maxRow * projectHeight) + gridY;
      sg.content.css({ height: height });
    },

    dragInit: function() {
      var sg = this, options = sg.options,
          $content = sg.content,
          $timeline = sg.timeline,
          gridX = options.views[options.view].grid.x,
          mouse = positions = {x: 0, y: 0},
          dragging = draggingX = draggingY = false,
          startMoment = curMoment = null,
          containerHeight = contentHeight = null,
          lockPadding = 10;

      $timeline.off().on("mousedown mousemove mouseup", function(e) {
        if(e.type === "mousedown") {
          // Turn on dragging
          dragging = true;

          // Record the current positions
          mouse = {x: e.pageX, y: e.pageY}
          positions = {
            x: parseInt($timeline.css("margin-left")),
            y: parseInt($content.css("margin-top"))
          }

          // Calculate dates
          var curDayOffset = Math.round(parseInt($timeline.css("margin-left")) / gridX);
          startMoment = moment(sg.startMoment).subtract("days", curDayOffset);

          // Store heights for calculating max drag values
          contentHeight = $content.height();
          containerHeight = sg.container.height() - sg.labels.height();

        } else if(e.type === "mousemove" && dragging) {
          if(!draggingX && !draggingY) {
            // Determine the drag axis
            if(Math.abs(e.pageX - mouse.x) > lockPadding) {
              draggingX = true;
            } else if(Math.abs(e.pageY - mouse.y) > lockPadding) {
              draggingY = true;
            }
          } else {
            // Move the content along the drag axis
            if(draggingX) {
              // Move horizontally
              var marginLeft = positions.x + (e.pageX - mouse.x);
              $timeline.css({ marginLeft: marginLeft });
            } else {
              // Move vertically
              var marginTop = positions.y + (e.pageY - mouse.y),
                  maxMargin = -(contentHeight - containerHeight);

              if(marginTop > 0) { marginTop = 0; }
              if(marginTop < maxMargin) { marginTop = maxMargin; }
              $content.css({ marginTop: marginTop });
            }
          }

        } else if(e.type === "mouseup") {
          // Turn off dragging
          dragging = draggingX = draggingY = false;

          // Calculate the currently selected day
          var curDayOffset = Math.round(parseInt($timeline.css("margin-left")) / gridX);
          curMoment = moment(sg.startMoment).subtract("days", curDayOffset);

          if(curMoment.format("MM DD") != startMoment.format("MM DD")) {
            // Set the new day as the current moment
            options.position.date = curMoment;
            options.position.top = parseInt($content.css("margin-top"));
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

      $(".sg-project").off().on("mouseenter mouseleave", function(e) {
        if(e.type === "mouseenter") {
          $(this).find(".sg-tasks").animate({ top: 20 }, 100);
        } else {
          $(this).find(".sg-tasks").animate({ top: 0 }, 100);
        }
      })
    },

    // Helper functions
    isBetween: function(first, middle, last) {
      return (first <= middle && middle <= last);
    }

  };

  // A really lightweight plugin wrapper around the constructor,
  // preventing against multiple instantiations
  $.fn[pluginName] = function ( projects, options ) {
    return this.each(function () {
      if (!$.data(this, "plugin_" + pluginName)) {
        $.data(this, "plugin_" + pluginName, new svgGantt( this, projects, options ));
      }
    });
  };

})( jQuery, window, document );