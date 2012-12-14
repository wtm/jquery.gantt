;(function($, window, document, undefined) {
  var pluginName = "gantt",
      defaults = {
        filter: {},
        mode: "regular",
        modes: {
          regular: { scale: 2, paddingX: 2, paddingY: 1, showContent: true },
          huge: { scale: 4, paddingX: 2, paddingY: 1, showContent: true },
          collapsed: { scale: .3, paddingX: 0, paddingY: .3, showContent: false }
        },
        position: { date: null, top: 0 },
        view: "year",
        views: {
          week: {
            grid: { color: "#DDD", x: 150, y: 10 },
            format: "MMM DD", labelEvery: "day", preloadDays: 30, dayOffset: 1, highlightDays: 7 },
          month: {
            grid: { color: "#DDD", x: 42, y: 10 },
            format: "MMM DD", labelEvery: "day", preloadDays: 30, dayOffset: 3, highlightDays: 10 },
          year: {
            grid: { color: "#DDD", x: 13, y: 10 },
            format: "MMM", labelEvery: "month", preloadDays: 30, dayOffset: 5, highlightDays: 10 }
        }
      };

  function Gantt(element, data, options) {
    var jg = this;
    jg.container = $(element);
    jg.options = $.extend({}, defaults, options);
    jg.projects = data.projects;
    jg.tasks = data.tasks;
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
      var projects = this.projects,
          tasks = this.tasks,
          project = null,
          task = null;

      // Go over each project
      for(i=0;i<projects.length;i++) {
        project = projects[i];

        // Convert to Unix time.
        if(isNaN(project.startDate)) {
          project.startDate = moment(project.startDate).unix();
          project.endDate = moment(project.endDate).unix();
        }

        project.ganttRow = 0;
      }

      // Sort them by their start time / ID
      projects.sort(function(a,b) {
        return a.startDate - b.startDate;
      });

      // Go over each task
      for(i=0;i<tasks.length;i++) {
        task = tasks[i];

        // Convert to Unix time.
        if(isNaN(task.date)) {
          task.date = moment(task.date).unix();
        }
      }

      // Sort them by their start time / ID
      tasks.sort(function(a,b) {
        return a.date - b.date;
      });
    },

    createUI: function() {
      var jg = this,
          $container = jg.container,

          // Create all of the elements
          elements = '<div class="jg-viewport">' +
                        '<div class="jg-timeline">' +
                          '<div class="jg-dates"></div>' +
                          '<div class="jg-tasks"></div>' +
                          '<div class="jg-content-wrap">' +
                            '<div class="jg-glow-top"></div>' +
                            '<div class="jg-content"></div>' +
                            '<div class="jg-glow-bottom"></div>' +
                          '</div>' +
                        '</div>' +
                        '<div class="jg-playhead"></div>' +
                        '<canvas class="jg-grid"></canvas>' +
                      '</div>';

      $container.empty().append(elements);

      // Create jQuery elements
      jg.contentWrap = $container.find(".jg-content-wrap");
      jg.glowTop = $container.find(".jg-glow-top");
      jg.glowBottom = $container.find(".jg-glow-bottom");
      jg.content = $container.find(".jg-content");
      jg.tasksContent = $container.find(".jg-tasks");
      jg.dates = $container.find(".jg-dates");
      jg.grid = $container.find(".jg-grid");
      jg.playhead = $container.find(".jg-playhead");
      jg.timeline = $container.find(".jg-timeline");
      jg.viewport = $container.find(".jg-viewport");
    },

    render: function() {
      var jg = this;

      console.time("render time")
      jg.clearUI();
      jg.setGlobals(); // Global variables that get calculated a lot
      jg.setActiveProjects(); // Only get the projects in the current timeframe
      jg.drawGrid();

      // Physical Application
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
      var jg = this;

      jg.content.empty();
      jg.dates.empty();
      jg.tasksContent.empty();
    },

    setGlobals: function() {
      var jg = this,
          options = jg.options,
          $container = jg.container;

      // Common Objects
      jg.mode = options.modes[options.mode];
      jg.view = options.views[options.view];

      // Calculate Dimensions
      jg.containerWidth = $container.width() + ((jg.view.dayOffset + 1) * jg.view.grid.x);
      jg.timelineWidth = jg.containerWidth * 3;
      jg.viewportHeight = $container.height() - jg.dates.height();

      // Calculate Timeframes
      var date = options.position.date,
          gridX = jg.view.grid.x;

      jg.daysUntilCurrent = Math.floor(jg.containerWidth / gridX);
      jg.daysInGrid = Math.floor(jg.timelineWidth / jg.view.grid.x);
      jg.curMoment = date ? moment(date) : moment();
      jg.startMoment = moment(jg.curMoment).subtract("days", jg.daysUntilCurrent);
      jg.endMoment = moment(jg.startMoment).add("days", jg.daysInGrid);
      jg.dayOffset = jg.view.dayOffset * gridX;

      // Others
      jg.settingNamePositions = false;
    },

    setActiveProjects: function() {
      // Static
      var jg = this, options = jg.options,
          view = jg.view,
          projects = jg.projects, project,
          tasks = jg.tasks, task,

          // Calculated
          preloadDays = (view.preloadDays * 24*60*60), // Load extra days
          timelineStart = jg.startMoment.unix() - preloadDays,
          timelineEnd = jg.endMoment.unix() + preloadDays;

      // Determine the projects within our timeframe
      jg.activeProjects = [];
      for(i=0;i<projects.length;i++) {
        project = projects[i];
        var isBetweenStart = jg.isBetween(timelineStart,project.startDate,timelineEnd),
            isBetweenEnd = jg.isBetween(timelineStart,project.endDate,timelineEnd),
            visible = true;

        for(filter in options.filter) {
          visible = false;
          theFilter = options.filter[filter];
          for(var j=0;j<theFilter.length;j++) {
            if(project[filter] === theFilter[j]) {
              visible = true;
            }
          }
        }

        if((isBetweenStart || isBetweenEnd) && visible) {
          jg.activeProjects.push(project);
        }
      }

      jg.activeTasks = [];
      for(i=0;i<tasks.length;i++) {
        task = tasks[i];

        if(jg.isBetween(timelineStart,task.date,timelineEnd)) {
          jg.activeTasks.push(task);
        }
      }
    },

    drawGrid: function() {
      var jg = this, options = this.options,
          canvas = jg.grid[0],
          ctx = canvas.getContext("2d"),
          view = options.views[options.view],
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
      jg.content.css({ background: "url("+data+")" });
    },

    setPosition: function() {
      // Static
      var jg = this, options = jg.options,
          view = jg.view,
          gridX = view.grid.x,
          offset = jg.dayOffset,

          // Calculated
          contentOffset = -(jg.daysUntilCurrent * gridX) + offset,
          playheadOffset = offset;

      // Move the timeline to the current date
      jg.timeline.css({
        left: contentOffset,
        width: jg.timelineWidth
      })

      jg.glowBottom.css({
       top: jg.viewportHeight - jg.glowBottom.height()
      })

      jg.playhead.css({
        left: playheadOffset,
        width: (view.highlightDays * gridX)
      })
    },

    drawLabels: function() {
      var jg = this, options = jg.options,
          view = jg.view,
          gridX = view.grid.x,
          labels = [],
          label = null;

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
          label = '<div class="jg-label" style="left:'+(gridX * i)+'px;width:'+gridX+'px;">'+
                    '<div class="jg-'+options.view+'">'+curMoment.format(format)+'</div>'+
                  '</div>';

          labels.push(label);
        }
      }
      jg.dates.append(labels.join(''));
    },

    createElements: function() {
      // Static
      var jg = this, options = jg.options,
          mode = jg.mode,
          view = jg.view,
          gridX = view.grid.x,
          gridY = view.grid.y,
          projects = jg.activeProjects,
          tasks = jg.activeTasks,
          elements = [],

          // Calculated
          el_height = gridY * mode.scale - 1,
          paddingY = gridY * mode.paddingY,
          paddingX = mode.paddingX * (24*60*60),
          maxRow = 0;

      // Iterate over each project
      for(var i=0;i<projects.length;i++) {
        var project = projects[i],

            // Determine the project date
            startDate = moment.unix(project.startDate),
            endDate = moment.unix(project.endDate),
            daysBetween = endDate.diff(startDate, "days") + 1,
            daysSinceStart = startDate.diff(jg.startMoment, "days"),

            // Element Attributes
            el_width = daysBetween * gridX - 1,
            el_left = daysSinceStart * gridX,
            el_top,

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
        for(var k=0;k<usedRows.length;k++) {
          usedRow = usedRows[k];
          if(row === usedRow) {
            row++;
          }
        }

        if(row > maxRow) {maxRow = row;}
        project.ganttRow = row;

        // Set the vertical offset
        el_top = paddingY + (row * (el_height + paddingY + 1));

        // Physical project element
        elements.push('<div class="jg-project" style="'+
                  'height:'+el_height+'px;'+
                  'left:'+el_left+'px;'+
                  'top: '+el_top+'px;'+
                  'z-index:'+(1000 - row)+';'+
                  'width:'+el_width+'px;">'+
                  '<div class="jg-data" style="background:'+project.color+';">');

        // If the project content is visible
        if(mode.showContent) {
          // The image and name
          elements.push('<div class="jg-name">'+
                      '<img class="jg-icon" src="'+project.iconURL+'" />'+
                      project.name +
                      '<span>'+startDate.format("MMMM D")+' - '+endDate.format("MMMM D")+'</span>'+
                      '</div>');
        }
        elements.push('</div>'); // Close jg-data

        if(mode.showContent) {
          elements.push('<div class="jg-tasks">'); // Close jg-data
          var taskOffset = (gridX / 2) - 2
          // Iterate over each task
          for(j=0;j<project.tasks.length;j++) {
            var task = project.tasks[j],
                task_left = (moment(startDate).diff(task.date, "days", true) * gridX) + taskOffset;
            elements.push('<div class="jg-task" style="left:'+task_left+'px;"></div>')
          }
          elements.push("</div>"); // Close jg-tasks
        }
        elements.push("</div>"); // Close jg-project
      }

      // Set the content height
      maxRow += 2;
      content_height = (maxRow * gridY) + (maxRow * el_height) + gridY;
      content_offset = -(jg.content.position().top)
      if(content_height < jg.viewportHeight) {
        // If the height is smaller than the the viewport/container height
        content_height = jg.viewportHeight;
        jg.content.animate({ top: 0 }, 100);
      } else if(content_height < content_offset + jg.viewportHeight) {
        // If the height is smaller than the current Y offset
        jg.content.animate({ top: jg.viewportHeight - content_height }, 100);
      }

      // Append the elements
      jg.content.append(elements.join('')).css({ height: content_height });

      // TASKS
      elements = [];
      console.log(tasks, "!")
      for(var i=0;i<tasks.length;i++) {
        var task = tasks[i],
            date = moment.unix(task.date),
            daysSinceStart = date.diff(jg.startMoment, "days"),
            el_left = daysSinceStart * gridX;
            console.log(daysSinceStart, "blah")
        console.log(task.date)
        elements.push('<div class="task" style="'+
                      'left:'+el_left+'px'+
                      '"></div>');
      }
      jg.tasksContent.append(elements.join(''));
    },

    dragInit: function() {
      var jg = this, options = jg.options,
          $content = jg.content,
          $timeline = jg.timeline,
          viewportHeight = jg.viewportHeight,
          view = jg.view,
          gridX = view.grid.x,
          mouse = positions = {x: 0, y: 0},
          dragging = draggingX = draggingY = false,
          startMoment = curMoment = null,
          contentHeight = null,
          lockPadding = 10;

      // Bind the drag
      jg.viewport.off().on("mousedown mousemove mouseup", function(e) {
        if(e.type === "mousedown") {
          // Turn on dragging
          dragging = true;

          // Record the current positions
          mouse = {x: e.pageX, y: e.pageY}
          positions = {
            x: $timeline.position().left,
            y: jg.content.position().top
          }

          // Calculate dates
          var curDayOffset = Math.round($timeline.position().left / gridX);
          startMoment = moment(jg.startMoment).subtract("days", curDayOffset);

          // Store heights for calculating max drag values
          contentHeight = $content.height();

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
              $timeline.css({ left: left });
              jg.setNamePositions();
            } else {
              // Move vertically
              var marginTop = positions.y + (e.pageY - mouse.y),
                  maxMargin = -(contentHeight - viewportHeight);

              if(marginTop > 0) { marginTop = 0; }
              if(marginTop < maxMargin) { marginTop = maxMargin; }
              $content.css({ top: marginTop });
              jg.setVerticalHints();
            }
          }

        } else if(e.type === "mouseup") {
          // Turn off dragging
          dragging = draggingX = draggingY = false;

          // Calculate the currently selected day
          var curDayOffset = Math.round(($timeline.position().left - jg.dayOffset) / gridX);
          curMoment = moment(jg.startMoment).subtract("days", curDayOffset);

          if(moment(curMoment).subtract("days", jg.view.dayOffset).format("MM DD") != startMoment.format("MM DD")) {
            // Set the new day as the current moment
            options.position.date = curMoment;
            options.position.top = jg.content.position().top;
            jg.render();
          }
        }
      })
    },

    setNamePositions: function() {
      var jg = this;

      if(jg.mode.showContent) {
        var $projects = $('.jg-project'),
            timelineOffset = -(jg.timeline.position().left),
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

    setVerticalHints: function() {
      var jg = this,
          offsetTop = -(jg.content.position().top),
          offsetBottom = jg.content.height() - offsetTop - jg.viewportHeight,
          glowHeight = 100;


      if(offsetTop > glowHeight) {offsetTop = glowHeight;}
      if(offsetBottom > glowHeight) {offsetBottom = glowHeight;}

      offsetTop = offsetTop / 20;
      offsetBottom = offsetBottom / 20;

      jg.glowTop.css({
        boxShadow: "inset 0 "+offsetTop+"px "+(offsetTop * 1.5)+"px 0 rgba(0,0,0,0.35)"
      })

      jg.glowBottom.css({
        boxShadow: "inset 0 -"+offsetBottom+"px "+(offsetBottom * 1.5)+"px 0 rgba(0,0,0,0.35)"
      })
    },

    createEvents: function() {
      var jg = this, options = jg.options,
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

      $(".jg-project").off().on("mouseenter mouseleave", function(e) {
        if(e.type === "mouseenter") {
          $(this).find(".jg-tasks").animate({ bottom: -15 }, 75);
        } else {
          $(this).find(".jg-tasks").animate({ bottom: 0 }, 50);
        }
      })
    },

    // Helper functions
    isBetween: function(first, middle, last) {
      return (first <= middle && middle <= last);
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