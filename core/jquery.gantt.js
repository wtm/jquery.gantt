;(function($, window, document, undefined) {
  var pluginName = "gantt",
      defaults = {
        filter: {},
        mode: "regular",
        modes: {
          regular: { scale: 2, paddingX: 2, paddingY: 1, showContent: true },
          large: { scale: 4, paddingX: 2, paddingY: 1, showContent: true },
          collapsed: { scale: .3, paddingX: 0, paddingY: .3, showContent: false }
        },
        position: { date: null, top: 0 },
        view: "year",
        views: {
          week: {
            grid: { color: "#DDD", x: 150, y: 10 },
            format: "MMM DD", labelEvery: "day", preloadDays: 60, dayOffset: 1, highlightDays: 7 },
          month: {
            grid: { color: "#DDD", x: 42, y: 10 },
            format: "MMM DD", labelEvery: "day", preloadDays: 30, dayOffset: 3, highlightDays: 10 },
          year: {
            grid: { color: "#DDD", x: 13, y: 10 },
            format: "MMM", labelEvery: "month", preloadDays: 0, dayOffset: 5, highlightDays: 10 }
        }
      };

  function Gantt(element, data, options) {
    var jg = this;
    jg.container = $(element);
    jg.options = $.extend(true, {}, defaults, options);
    jg.data = data;
    jg.init();
  }

  Gantt.prototype = {
    init: function() {
      var jg = this;

      // Initial calculations
      jg.parseData();
      jg.createUI();
      jg.render();
    },

    parseData: function() {
      var jg = this,
          projects = jg.data.projects,
          tasks = jg.data.tasks,
          project, task;

      // Go over each Project
      for(var i=0;i<projects.length;i++) {
        project = projects[i];

        // Convert to Unix time.
        if(isNaN(project.startDate)) {
          project.startDate = moment(project.startDate).unix();
          project.endDate = moment(project.endDate).unix();
        }

        // Convert tasks to unix
        for(var j=0;j<project.tasks.length;j++) {
          task = project.tasks[j];
          if(isNaN(task.date)) {
            task.date = moment(task.date).unix();
          }
        }

        // Required default data
        project.ganttRow = 0;
      }
      // Sort Projects by start date
      projects.sort(function(a,b) { return a.startDate - b.startDate; });

      // Go over each Task
      for(var i=0;i<tasks.length;i++) {
        task = tasks[i];

        // Convert to Unix time.
        if(isNaN(task.date)) {
          task.date = moment(task.date).unix();
        }
      }

      // Sort Tasks by start date
      tasks.sort(function(a,b) { return a.date - b.date; });
    },

    createUI: function() {
      var jg = this,
          $container = jg.container,
          $elements = jg.elements = {},

          // Create all of the elements
          elements = '<div class="jg-viewport">' +
                        '<div class="jg-timeline">' +
                          '<div class="jg-header-dates"></div>' +
                          '<div class="jg-header-tasks"></div>' +
                          '<div class="jg-content-wrap">' +
                            '<div class="jg-glow"></div>' +
                            '<div class="jg-content"></div>' +
                            '<div class="jg-glow"></div>' +
                          '</div>' +
                        '</div>' +
                        '<div class="jg-scrub">' +
                          '<div class="jg-scrub-inner"></div>' +
                          '<div class="jg-handle">' +
                            '<div class="jg-handle-inner"></div>' +
                          '</div>' +
                        '</div>' +
                        '<div class="jg-scrub-timeframe"></div>' +
                        '<canvas class="jg-grid"></canvas>' +
                      '</div>';

      $container.empty().append(elements);

      // Create jQuery elements
      $elements.viewport = $container.find(".jg-viewport");
      $elements.timeline = $container.find(".jg-timeline");
      $elements.dates = $container.find(".jg-header-dates");
      $elements.tasks = $container.find(".jg-header-tasks");
      $elements.contentWrap = $container.find(".jg-content-wrap");
      $elements.glowTop = $container.find(".jg-glow").first();
      $elements.content = $container.find(".jg-content");
      $elements.glowBottom = $container.find(".jg-glow").last();
      $elements.scrubTimeframe = $container.find(".jg-scrub-timeframe");
      $elements.scrub = $container.find(".jg-scrub");
      $elements.grid = $container.find(".jg-grid");
    },

    render: function() {
      var jg = this;

      console.time("render time")
      jg.clearUI(); // Remove old elements
      jg.setGlobals(); // Global variables that get calculated a lot
      jg.setActiveProjects(); // Only get the projects in the current timeframe
      jg.drawGrid(); // Draw the tiled grid background

      jg.setPosition(); // Determine the current visual position in time
      jg.drawLabels(); // Draw the grid background
      jg.createElements(); // Loop through the projects and create elements
      jg.dragInit(); // Loop through the projects and create elements
      jg.setNamePositions();
      jg.setVerticalHints();
      jg.createEvents();
      console.timeEnd("render time")
    },

    clearUI: function() {
      var $elements = this.elements;

      $elements.content.empty();
      $elements.dates.empty();
      $elements.tasks.empty();
    },

    setGlobals: function() {
      var jg = this,
          options = jg.options,
          $elements = jg.elements,
          $container = jg.container;

      // Common Objects
      jg.mode = options.modes[options.mode];
      jg.view = options.views[options.view];

      var gridX = jg.view.grid.x,
          date = options.position.date;

      // Calculate Dimensions
      jg.scrubOffset = (jg.view.dayOffset + 1) * gridX;
      jg.containerWidth = $container.width() + jg.scrubOffset;
      jg.timelineWidth = jg.containerWidth * 3;
      jg.viewportHeight = $container.height() - $elements.dates.height() - $elements.tasks.height();
      jg.glowHeight = $elements.glowBottom.height();
      jg.tasksHeight = $elements.tasks.height();

      // Calculate Timeframes
      jg.daysUntilCurrent = Math.floor(jg.containerWidth / gridX);
      jg.daysInGrid = Math.floor(jg.timelineWidth / gridX);
      jg.curMoment = date ? moment(date) : moment();
      jg.startMoment = moment(jg.curMoment).subtract("days", jg.daysUntilCurrent);
      jg.endMoment = moment(jg.startMoment).add("days", jg.daysInGrid);
      jg.dayOffset = jg.view.dayOffset * gridX;
    },

    setActiveProjects: function() {
      var jg = this,
          options = jg.options,
          view = jg.view,
          projects = jg.data.projects,
          tasks = jg.data.tasks,

          // Calculated
          preloadDays = (view.preloadDays * 24*60*60), // Load extra days
          timelineStart = jg.startMoment.unix() - preloadDays,
          timelineEnd = jg.endMoment.unix() + preloadDays,

      // Determine the projects within our timeframe
      activeProjects = jg.data.activeProjects = [];
      for(var i=0;i<projects.length;i++) {
        var project = projects[i],
            isBetweenStart = jg.isBetween(timelineStart,project.startDate,timelineEnd),
            isBetweenEnd = jg.isBetween(timelineStart,project.endDate,timelineEnd);

        // Determine if it is filtered
        visible = true;
        for(var filter in options.filter) {
          var visible = false,
              theFilter = options.filter[filter];
          for(var j=0;j<theFilter.length;j++) {
            if(project[filter] === theFilter[j]) {
              visible = true;
            }
          }
        }

        if(visible && (isBetweenStart || isBetweenEnd)) {
          activeProjects.push(project);
        }
      }

      activeTasks = jg.data.activeTasks = [];
      for(var i=0;i<tasks.length;i++) {
        var task = tasks[i];

        if(jg.isBetween(timelineStart,task.date,timelineEnd)) {
          activeTasks.push(task);
        }
      }
    },

    drawGrid: function() {
      var jg = this,
          options = this.options,
          $elements = jg.elements,
          canvas = $elements.grid[0],
          ctx = canvas.getContext("2d"),
          view = jg.view,
          gridX = view.grid.x,
          gridY = view.grid.y;

      // Create a canvas that fits the rectangle
      canvas.height = gridY;
      canvas.width = gridX;

      // Draw the grid image
      // Use 0.5 to compensate for canvas pixel quirk
      ctx.moveTo(gridX - 0.5, -0.5);
      ctx.lineTo(gridX - 0.5, gridY - 0.5);
      ctx.lineTo(-0.5,gridY - 0.5);
      ctx.strokeStyle = view.grid.color;
      ctx.stroke();

      // Create a repeated image from canvas
      data = canvas.toDataURL("image/jpg");
      $elements.content.css({ background: "url("+data+")" });
    },

    setPosition: function() {
      // Static
      var jg = this,
          options = jg.options,
          $elements = jg.elements,
          view = jg.view,
          gridX = view.grid.x,
          offset = jg.dayOffset,

          // Calculated
          contentOffset = -(jg.daysUntilCurrent * gridX) + offset,
          playheadOffset = offset;

      // Move the timeline to the current date
      $elements.timeline.css({
        left: contentOffset,
        width: jg.timelineWidth
      })

      $elements.glowBottom.css({
       top: jg.viewportHeight - jg.glowHeight
      })

      $elements.scrub.css({
        left: playheadOffset
      })

      $elements.scrubTimeframe.css({
        left: playheadOffset,
        width: (view.highlightDays * gridX)
      })
    },

    drawLabels: function() {
      var jg = this,
          options = jg.options,
          view = jg.view,
          gridX = view.grid.x,
          labels = [];

      // Iterate over each day
      for(var i=0;i<jg.daysInGrid;i++) {
        var curMoment = moment(jg.startMoment).add("days", i),
            format = false;

        // Determine if the label should be present
        switch(view.labelEvery) {
          case "month":
            if(curMoment.format("D") === "1") { format = view.format; }
            break;
          default:
            format = view.format
        }

        if(format && moment().format("YYYY") != curMoment.format("YYYY")) {
          format += ", YYYY"
        }

        // Create the label
        if(format) {
          var label = '<div class="jg-label" style="left:'+(gridX * i)+'px;width:'+gridX+'px;">'+
                    '<div class="jg-'+options.view+'">'+curMoment.format(format)+'</div>'+
                  '</div>';

          labels.push(label);
        }
      }
      jg.elements.dates.append(labels.join(''));
    },

    createElements: function() {
      // Static
      var jg = this,
          options = jg.options,
          $elements = jg.elements,
          mode = jg.mode,
          view = jg.view,
          gridX = view.grid.x,
          gridY = view.grid.y,
          projects = jg.data.activeProjects,
          tasks = jg.data.activeTasks,
          elements = [],

          // Calculated
          el_height = gridY * mode.scale - 1,
          paddingY = gridY * mode.paddingY,
          paddingX = mode.paddingX * (24*60*60),
          maxRow = 0,
          tasksLength = tasks.length;

      // Iterate over each project
      for(var i=0;i<projects.length;i++) {
        var project = projects[i],

            // Determine the project date
            startDate = moment.unix(project.startDate),
            endDate = moment.unix(project.endDate),
            daysBetween = endDate.diff(startDate, "days") + 1,
            daysSinceStart = startDate.diff(jg.startMoment, "days") + 1,

            // Element Attributes
            el_width = daysBetween * gridX - 1,
            el_left = daysSinceStart * gridX,

            // For determining top offset
            projectStartPad = startDate.unix() - paddingX,
            projectEndPad = endDate.unix() + paddingX,
            row = 0,
            usedRows = [];

        // Loop over every project before this one
        for(var j=0;j<i;j++) {
          var compared = projects[j],
              comparedStart = compared.startDate,
              comparedEnd = compared.endDate;

          // Determine if this project is within the range of the
          // currently selected one.
          if(jg.isBetween(comparedStart, projectStartPad, comparedEnd)) {
            usedRows.push(compared.ganttRow);
          } else if(jg.isBetween(projectStartPad, comparedEnd, projectEndPad)) {
            usedRows.push(compared.ganttRow);
          } else if(jg.isBetween(comparedStart, projectEndPad, comparedEnd)) {
            usedRows.push(compared.ganttRow);
          } else if(jg.isBetween(projectStartPad, comparedStart, projectEndPad)) {
            usedRows.push(compared.ganttRow);
          }
        }

        // Determine the correct row
        usedRows.sort(function(a,b) { return a-b });
        for(var j=0;j<usedRows.length;j++) {
          usedRow = usedRows[j];
          if(row === usedRow) {
            row++;
          }
        }

        if(row > maxRow) {maxRow = row;}
        project.ganttRow = row;

        // Set the vertical offset
        var el_top = paddingY + (row * (el_height + paddingY + 1));

        // Physical project element
        elements.push('<div class="jg-project" style="'+
                  'height:'+el_height+'px;'+
                  'left:'+el_left+'px;'+
                  'top: '+el_top+'px;'+
                  'z-index:'+(499 - row)+';'+
                  'width:'+el_width+'px;">'+
                  '<div class="jg-data" style="background:'+project.color+';">');

        // If the project content is visible
        if(mode.showContent) {
          // The image and name
          elements.push('<div class="jg-name">');
          if(project.iconURL) {
            elements.push('<img class="jg-icon" src="'+project.iconURL+'" />');
          }
          elements.push(project.name + '<div class="jg-date">'+startDate.format("MMMM D") +
                        ' - ' + endDate.format("MMMM D")+'</div></div>');
        }
        elements.push('</div>'); // Close jg-data

        if(mode.showContent) {
          // Create tasks
          elements.push('<div class="jg-tasks">'); // Close jg-data
          elements.push(jg.createTasks(project.tasks, startDate, el_height, 0))
          elements.push("</div>"); // Close jg-tasks
        }
        elements.push("</div>"); // Close jg-project
      }
      // Set the content height
      maxRow += 2;
      content_height = (maxRow * gridY) + (maxRow * el_height) + gridY;
      content_offset = -($elements.content.position().top)
      if(content_height < jg.viewportHeight) {
        // If the height is smaller than the the viewport/container height
        content_height = jg.viewportHeight;
        $elements.content.animate({ top: 0 }, 100);
      } else if(content_height < content_offset + jg.viewportHeight) {
        // If the height is smaller than the current Y offset
        $elements.content.animate({ top: jg.viewportHeight - content_height }, 100);
      }

      // Append the elements
      $elements.content.append(elements.join('')).css({ height: content_height });

      // TASKS
      $elements.tasks.append(jg.createTasks(tasks, jg.startMoment, jg.tasksHeight, 1));
    },

    dragInit: function() {
      var jg = this, options = jg.options,
          $elements = jg.elements,
          viewportHeight = jg.viewportHeight,
          view = jg.view,
          gridX = view.grid.x,
          mouse = positions = {x: 0, y: 0},
          dragging = draggingX = draggingY = false,
          startMoment = curMoment = null,
          contentHeight = null,
          lockPadding = 10;

      // Bind the drag
      $elements.viewport.off().on("mousedown mousemove mouseup", function(e) {
        if(e.type === "mousedown") {
          // Turn on dragging
          dragging = true;

          // Record the current positions
          mouse = {x: e.pageX, y: e.pageY}
          positions = {
            x: $elements.timeline.position().left,
            y: $elements.content.position().top
          }

          // Calculate dates
          var curDayOffset = Math.round($elements.timeline.position().left / gridX);
          startMoment = moment(jg.startMoment).subtract("days", curDayOffset);

          // Store heights for calculating max drag values
          contentHeight = $elements.content.height();

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
              var left = positions.x + (e.pageX - mouse.x);
              $elements.timeline.css({ left: left });
              jg.setNamePositions();
            } else {
              // Move vertically
              var marginTop = positions.y + (e.pageY - mouse.y),
                  maxMargin = -(contentHeight - viewportHeight);

              if(marginTop > 0) { marginTop = 0; }
              if(marginTop < maxMargin) { marginTop = maxMargin; }
              $elements.content.css({ top: marginTop });
              jg.setVerticalHints();
            }
          }

        } else if(e.type === "mouseup") {
          // Turn off dragging
          dragging = draggingX = draggingY = false;

          // Calculate the currently selected day
          var curDayOffset = Math.round(($elements.timeline.position().left - jg.dayOffset) / gridX);
          curMoment = moment(jg.startMoment).subtract("days", curDayOffset);

          if(moment(curMoment).subtract("days", jg.view.dayOffset).format("MM DD") != startMoment.format("MM DD")) {
            // Set the new day as the current moment
            options.position.date = curMoment;
            options.position.top = $elements.content.position().top;
            jg.render();
          }
        }
      })
    },

    setNamePositions: function() {
      var jg = this;

      if(jg.mode.showContent) {
        var $projects = $('.jg-project'),
            timelineOffset = -(jg.elements.timeline.position().left),
            complete = false;

        for(var i=0;i<$projects.length;i++) {
          var $project = $($projects[i]),
              projOffset = $project.position().left;

          if(projOffset < timelineOffset + 500) {
            var projWidth = $project.width();

            if(projOffset + projWidth > timelineOffset - 500) {
              var $name = $project.find(".jg-name"),
                  dataWidth = projWidth - (timelineOffset - projOffset);

              if(dataWidth <= projWidth) {
                $name.width(dataWidth)
              } else {
                $name.width(projWidth)
              }
            }
            complete = true;
          } else if(complete) {
            return false;
          }
        }
      }
    },

    createEvents: function() {
      var jg = this,
          options = jg.options,
          $container = jg.container;

      // Move to today
      $container.off("gantt-moveto").on("gantt-moveto", function(e, date) {
        options.position.date = date;
        jg.render();
      });

      // Change the current view
      $container.off("gantt-changeView").on("gantt-changeView", function(e, view) {
        options.view = view;
        jg.render();
      });

      // Change the current filter
      $container.off("gantt-filterBy").on("gantt-filterBy", function(e, filter) {
        options.filter = filter;
        jg.render();
      });

      // Change the current view
      $container.off("gantt-changeMode").on("gantt-changeMode", function(e, mode) {
        options.mode = mode;
        jg.render();
      });

      $container.find(".jg-project").off().on("mouseenter mouseleave", function(e) {
        projectHeight:
        if(e.type === "mouseenter") {
          $(this).find(".jg-tasks").show();
        } else {
          $(this).find(".jg-tasks").hide();
        }
      })
    },

    setVerticalHints: function() {
      var jg = this,
          $elements = jg.elements,
          offsetTop = -($elements.content.position().top),
          offsetBottom = $elements.content.height() - offsetTop - jg.viewportHeight,
          glowHeight = 40;


      if(offsetTop > glowHeight) {offsetTop = glowHeight;}
      if(offsetBottom > glowHeight) {offsetBottom = glowHeight;}

      offsetTop = offsetTop / 10;
      offsetBottom = offsetBottom / 10;

      $elements.glowTop.css({
        boxShadow: "inset 0 "+offsetTop+"px "+(offsetTop * 2)+"px 0 rgba(0,0,0,0.45)"
      })

      $elements.glowBottom.css({
        boxShadow: "inset 0 -"+offsetBottom+"px "+(offsetBottom * 2)+"px 0 rgba(0,0,0,0.45)"
      })
    },

    // Helper functions
    isBetween: function(first, middle, last) {
      return (first <= middle && middle <= last);
    },

    createTasks: function(tasks, startDate, containerHeight, offset) {
      var jg = this,
          gridX = jg.view.grid.x,
          tasksLength = tasks.length,
          elements = [];

      for(var i=0;i<tasksLength;i++) {
        var task = tasks[i],
            size = 5,
            date = moment.unix(task.date),
            daysSinceStart = date.diff(startDate, "days") + offset,
            task_left = daysSinceStart * gridX;

        for(var j=i+1;j<tasksLength;j++) {
          var nextTask = tasks[j];
          if(nextTask.date === task.date) {
            if(size + 2 < containerHeight && size + 2 < gridX) {
              size += 2;
            }
            i = j;
          } else {
            break;
          }
        }

        task_top = (containerHeight / 2) - (size / 2)
        task_left = task_left + (gridX / 2) - (size / 2)

        elements.push('<div class="jg-task" data-id="'+j+'" '+
                      'style="'+
                      'left:'+task_left+'px;'+
                      'height:'+size+'px;'+
                      'width:'+size+'px;'+
                      'top:'+task_top+'px;'+
                      '"></div>');
      }
      return elements.join('');
    }

  };

  $.fn[pluginName] = function (data, options) {
    return this.each(function () {
      if(!$.data(this, "plugin_" + pluginName)) {
        $.data(this, "plugin_" + pluginName, new Gantt(this, data, options));
      }
    });
  };

})(jQuery, window, document);