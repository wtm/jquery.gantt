(($, window, undef) -> $ ->
	pluginName = "gantt"
	defaults =
		filter: {}
		mode: "regular"
		modes:
			regular: { scale: 2, paddingX: 2, paddingY: 1, showContent: true }
			large: { scale: 4, paddingX: 2, paddingY: 1, showContent: true }
			collapsed: { scale: 0.3, paddingX: 0, paddingY: 0.3, showContent: false }
		position: { date: null, top: 0 }
		view: "year"
		views:
			week:
				dayOffset: 1
				format: "MMM DD"
				grid: { color: "#DDD", x: 150, y: 10 }
				highlightDays: 7
				labelEvery: "day"
				preloadDays: 60
			month:
				dayOffset: 3
				format: "MMM DD"
				grid: { color: "#DDD", x: 42, y: 10 }
				highlightDays: 10
				labelEvery: "day"
				preloadDays: 30
			year:
				dayOffset: 5
				format: "MMM"
				grid: { color: "#DDD", x: 13, y: 10 }
				highlightDays: 10
				labelEvery: "month"
				preloadDays: 0
	SECONDS_IN_DAY = 24 * 60 * 60

	class Gantt
		constructor: (element, data, options) ->
			@container = $(element)
			@data = data
			@elements = {}
			@options = $.extend true, {}, defaults, options

			@init()

		init: =>
			# Initial calculations
			@parseData()
			@createUI()
			@render()

		parseData: =>
			projects = @data.projects
			tasks = @data.tasks

			# Go over each Project
			for project in projects
				# Convert to Unix time.
				if isNaN project.startDate
					project.startDate = moment(project.startDate).unix()
					project.endDate = moment(project.endDate).unix()

				# Convert tasks to unix
				for task in project.tasks
					task.date = moment(task.date).unix() if isNaN task.date

				# Required default data
				project.ganttRow = 0

			# Sort Projects by start date
			projects.sort (a, b) -> a.startDate - b.startDate

			# Go over each Task
			for task in tasks
				# Convert to Unix time.
				task.date = moment(task.date).unix() if isNaN task.date

			# Sort Tasks by start date
			tasks.sort (a, b) -> a.startDate - b.startDate

		createUI: =>
			$container = @container

			# Create all of the elements
			elements = "<div class='jg-viewport'>
					<div class='jg-timeline'>
						<div class='jg-header-dates'></div>
						<div class='jg-header-tasks'></div>
						<div class='jg-content-wrap'>
							<div class='jg-glow'></div>
							<div class='jg-content'></div>
							<div class='jg-glow'></div>
						</div>
					</div>
					<div class='jg-scrub'>
						<div class='jg-scrub-inner'></div>
						<div class='jg-handle'>
							<div class='jg-handle-inner'></div>
						</div>
					</div>
					<div class='jg-scrub-timeframe'></div>
					<canvas class='jg-grid'></canvas>
				</div>"

			$container.empty().append elements

			# Create jQuery elements
			@elements.viewport = $container.find ".jg-viewport"
			@elements.timeline = $container.find ".jg-timeline"
			@elements.dates = $container.find ".jg-header-dates"
			@elements.tasks = $container.find ".jg-header-tasks"
			@elements.contentWrap = $container.find ".jg-content-wrap"
			@elements.glowTop = $container.find(".jg-glow").first()
			@elements.content = $container.find ".jg-content"
			@elements.glowBottom = $container.find(".jg-glow").last()
			@elements.scrubTimeframe = $container.find ".jg-scrub-timeframe"
			@elements.scrub = $container.find ".jg-scrub"
			@elements.grid = $container.find ".jg-grid"

		render: =>
			console.time "render time"
			@clearUI() # Remove old elements
			@setGlobals() # Global variables that get calculated a lot
			@setActiveProjects() # Only get the projects in the current timeframe
			@drawGrid() # Draw the tiled grid background

			@setPosition() # Determine the current visual position in time
			@drawLabels() # Draw the grid background
			@createElements() # Loop through the projects and create elements
			@dragInit() # Loop through the projects and create elements
			@setNamePositions()
			@setVerticalHints()
			@createEvents()
			console.timeEnd "render time"

		clearUI: =>
			@elements.content.empty()
			@elements.dates.empty()
			@elements.tasks.empty()

		setGlobals: =>
			options = @options
			$elements = @elements
			$container = @container

			# Common Objects
			@mode = options.modes[options.mode]
			@view = options.views[options.view]

			gridX = @view.grid.x
			date = options.position.date

			# Calculate Dimensions
			@scrubOffset = (@view.dayOffset + 1) * gridX
			@containerWidth = $container.width() + @scrubOffset
			@timelineWidth = @containerWidth * 3
			@viewportHeight = $container.height() - $elements.dates.height() - $elements.tasks.height()
			@glowHeight = $elements.glowBottom.height()
			@tasksHeight = $elements.tasks.height()

			# Calculate Timeframes
			@daysUntilCurrent = Math.floor(@containerWidth / gridX)
			@daysInGrid = Math.floor(@timelineWidth / gridX)
			@curMoment = if date then moment(date) else moment()
			@startMoment = moment(@curMoment).subtract "days", @daysUntilCurrent
			@endMoment = moment(@startMoment).add "days", @daysInGrid
			@dayOffset = @view.dayOffset * gridX

		setActiveProjects: =>
			options = @options
			view = @view
			projects = @data.projects
			tasks = @data.tasks

			# Calculated
			preloadDays = view.preloadDays * SECONDS_IN_DAY # Load extra days
			timelineStart = @startMoment.unix() - preloadDays
			timelineEnd = @endMoment.unix() + preloadDays

			# Determine the projects within our timeframe
			activeProjects = @data.activeProjects = []
			for project in projects
				isBetweenStart = @isBetween timelineStart, project.startDate, timelineEnd
				isBetweenEnd = @isBetween timelineStart, project.endDate, timelineEnd

				# Determine if it is filtered
				visible = true
				if options.filter?
					for filter in options.filter
						visible = false
						theFilter = options.filter[filter]

						for x in theFilter
							visible = project[filter] is theFilter[x]

				if visible and (isBetweenStart or isBetweenEnd)
					activeProjects.push project

			activeTasks = @data.activeTasks = []
			for task in tasks
				if @isBetween timelineStart, task.date, timelineEnd
					activeTasks.push task

		drawGrid: =>
			options = @options
			$elements = @elements
			canvas = $elements.grid[0]
			ctx = canvas.getContext "2d"
			view = @view
			gridX = view.grid.x
			gridY = view.grid.y

			# Create a canvas that fits the rectangle
			canvas.height = gridY
			canvas.width = gridX

			# Draw the grid image
			# Use 0.5 to compensate for canvas pixel quirk
			ctx.moveTo gridX - 0.5, -0.5
			ctx.lineTo gridX - 0.5, gridY - 0.5
			ctx.lineTo -0.5, gridY - 0.5
			ctx.strokeStyle = view.grid.color
			ctx.stroke()

			# Create a repeated image from canvas
			data = canvas.toDataURL "image/jpg"
			$elements.content.css
				background: "url(#{data})"

		setPosition: =>
			# Static
			options = @options
			$elements = @elements
			view = @view
			gridX = view.grid.x
			offset = @dayOffset

			# Calculated
			contentOffset = -(@daysUntilCurrent * gridX) + offset
			playheadOffset = offset

			# Move the timeline to the current date
			$elements.timeline.css
				left: contentOffset,
				width: @timelineWidth

			$elements.glowBottom.css
				top: @viewportHeight - @glowHeight

			$elements.scrub.css
				left: playheadOffset

			$elements.scrubTimeframe.css
				left: playheadOffset,
				width: view.highlightDays * gridX

		drawLabels: =>
			options = @options
			view = @view
			gridX = view.grid.x
			labels = []

			# Iterate over each day
			for day in @daysInGrid
				curMoment = moment(@startMoment).add "days", day
				format = false

				# Determine if the label should be present
				switch view.labelEvery
					when "month"
						format = view.format if curMoment.format("D") is "1"
					else
						format = view.format

				if format and moment().format("YYYY") isnt curMoment.format("YYYY")
					format += ", YYYY"

				# Create the label
				if format
					label = "<div class='jg-label' style='left:#{(gridX * day)}px; width:#{gridX}px'>
						<div class='jg-#{options.view}'>#{curMoment.format format}</div>
					</div>"

					labels.push label

			@elements.dates.append labels.join ""

		createElements: =>
			# Static
			options = @options
			$elements = @elements
			mode = @mode
			view = @view
			gridX = view.grid.x
			gridY = view.grid.y
			projects = @data.activeProjects
			tasks = @data.activeTasks
			elements = []

			# Calculated
			el_height = gridY * mode.scale - 1
			paddingY = gridY * mode.paddingY
			paddingX = mode.paddingX * SECONDS_IN_DAY
			maxRow = 0

			# Iterate over each project
			for project, idx in projects
				# Determine the project date
				startDate = moment.unix project.startDate
				endDate = moment.unix project.endDate
				daysBetween = endDate.diff(startDate, "days") + 1
				daysSinceStart = startDate.diff(@startMoment, "days") + 1

				# Element Attributes
				el_width = daysBetween * gridX - 1
				el_left = daysSinceStart * gridX

				# For determining top offset
				projectStartPad = startDate.unix() - paddingX
				projectEndPad = endDate.unix() + paddingX
				row = 0
				usedRows = []

				# Loop over every project before this one
				for n in [0...idx]
					compared = projects[n]
					comparedStart = compared.startDate
					comparedEnd = compared.endDate

					# Determine if this project is within the range of the
					# currently selected one.
					if @isBetween(comparedStart, projectStartPad, comparedEnd) or
							@isBetween(projectStartPad, comparedEnd, projectEndPad) or
							@isBetween(comparedStart, projectEndPad, comparedEnd) or
							@isBetween(projectStartPad, comparedStart, projectEndPad)
						usedRows.push compared.ganttRow

				# Determine the correct row
				usedRows.sort (a, b) -> a - b
				for usedRow in usedRows
					row++ if row is usedRow

				maxRow = row if row > maxRow
				project.ganttRow = row

				# Set the vertical offset
				el_top = paddingY + (row * (el_height + paddingY + 1))

				# Physical project element
				elements.push "<div class='jg-project' style='
					height:#{el_height}px;
					left:#{el_left}px;
					top:#{el_top}px;
					z-index:#{499 - row};
					width:#{el_width}px'>
					<div class='jg-data' style='background:#{project.color}'>"

				# If the project content is visible
				if mode.showContent
					# The image and name
					elements.push "<div class='jg-name'>"
					if project.iconURL
						elements.push "<img class='jg-icon' src='#{project.iconURL}'>"
					elements.push "#{project.name}<div class='jg-date'>#{startDate.format "MMMM D"} - #{endDate.format "MMMM D"}</div></div>"
				elements.push "</div>" # Close jg-data

				if mode.showContent
					# Create tasks
					elements.push "<div class='jg-tasks'>"
					elements.push @createTasks project.tasks, startDate, el_height, 0
					elements.push "</div>" # Close jg-tasks
				elements.push "</div>" # Close jg-project

			# Set the content height
			maxRow += 2
			content_height = (maxRow * gridY) + (maxRow * el_height) + gridY
			content_offset = -($elements.content.position().top)
			if content_height < @viewportHeight
				# If the height is smaller than the the viewport/container height
				content_height = @viewportHeight
				$elements.content.animate { top: 0 }, 100
			else if content_height < content_offset + @viewportHeight
				# If the height is smaller than the current Y offset
				$elements.content.animate { top: @viewportHeight - content_height }, 100

			# Append the elements
			$elements.content.append(elements.join("")).css
				height: content_height

			# TASKS
			$elements.tasks.append @createTasks tasks, @startMoment, @tasksHeight, 1

		dragInit: =>
			options = @options
			$elements = @elements
			viewportHeight = @viewportHeight
			view = @view
			gridX = view.grid.x
			mouse = positions = { x: 0, y: 0 }
			dragging = draggingX = draggingY = false
			startMoment = curMoment = null
			contentHeight = null
			lockPadding = 10

			that = @

			# Bind the drag
			$elements.viewport.off().on "mousedown mousemove mouseup", (e) ->
				if e.type is "mousedown"
					# Turn on dragging
					dragging = true

					# Record the current positions
					mouse = { x: e.pageX, y: e.pageY }
					positions =
						x: $elements.timeline.position().left
						y: $elements.content.position().top

					# Calculate dates
					curDayOffset = Math.round($elements.timeline.position().left / gridX)
					startMoment = moment(that.startMoment).subtract "days", curDayOffset

					# Store heights for calculating max drag values
					contentHeight = $elements.content.height()

				else if e.type is "mousemove" and dragging
					unless draggingX or draggingY
						# Determine the drag axis
						if Math.abs(e.pageX - mouse.x) > lockPadding
							draggingX = true
						else if Math.abs(e.pageY - mouse.y) > lockPadding
							draggingY = true
					else
						# Move the content along the drag axis
						if draggingX
							# Move horizontally
							left = positions.x + (e.pageX - mouse.x)
							$elements.timeline.css
								left: left
							that.setNamePositions()
						else
							# Move vertically
							marginTop = positions.y + (e.pageY - mouse.y)
							overflowHeight = -(contentHeight - viewportHeight)

							# Cap `marginTop` to the range `overflowHeight..0`
							marginTop = Math.max Math.min(marginTop, 0), overflowHeight
							$elements.content.css
								top: marginTop
							that.setVerticalHints()

				else if e.type is "mouseup"
					# Turn off dragging
					dragging = draggingX = draggingY = false

					# Calculate the currently selected day
					curDayOffset = Math.round(($elements.timeline.position().left - that.dayOffset) / gridX)
					curMoment = moment(that.startMoment).subtract "days", curDayOffset

					if moment(curMoment).subtract("days", that.view.dayOffset).format("MM DD") isnt startMoment.format("MM DD")
						# Set the new day as the current moment
						options.position.date = curMoment
						options.position.top = $elements.content.position().top
						that.render()

		setNamePositions: =>
			if @mode.showContent
				$projects = $(".jg-project")
				timelineOffset = -(@elements.timeline.position().left)
				complete = false

				for project in $projects
					$project = $(project)
					projOffset = $project.position().left

					if projOffset < timelineOffset + 500
						projWidth = $project.width()

						if projOffset + projWidth > timelineOffset - 500
							$name = $project.find(".jg-name")
							dataWidth = projWidth - (timelineOffset - projOffset)

							$name.width (if dataWidth <= projWidth then dataWidth else projWidth)

						complete = true
					else if complete
						false

		createEvents: =>
			# jQuery scribbles over `this` in callbacks
			that = @
			options = @options
			$container = @container

			# Move to today
			$container.off("gantt-moveto").on "gantt-moveto", (e, date) ->
				options.position.date = date
				that.render()

			# Change the current view
			$container.off("gantt-changeView").on "gantt-changeView", (e, view) ->
				options.view = view
				that.render()

			# Change the current filter
			$container.off("gantt-filterBy").on "gantt-filterBy", (e, filter) ->
				options.filter = filter
				that.render()

			# Change the current view
			$container.off("gantt-changeMode").on "gantt-changeMode", (e, mode) ->
				options.mode = mode
				that.render()

			$container.find(".jg-project").off().on "mouseenter mouseleave", (e) ->
				if e.type is "mouseenter"
					$(@).find(".jg-tasks").show()
				else
					$(@).find(".jg-tasks").hide()

		setVerticalHints: =>
			$elements = @elements
			offsetTop = -($elements.content.position().top)
			offsetBottom = $elements.content.height() - offsetTop - @viewportHeight
			glowHeight = 40

			offsetTop = Math.min(offsetTop, glowHeight) / 10
			$elements.glowTop.css
				boxShadow: "inset 0 #{offsetTop}px #{offsetTop * 2}px 0 rgba(0, 0, 0, 0.45)"

			offsetBottom = Math.min(offsetBottom, glowHeight) / 10
			$elements.glowBottom.css
				boxShadow: "inset 0 -#{offsetBottom}px #{offsetBottom * 2}px 0 rgba(0, 0, 0, 0.45)"

		# Helper functions
		isBetween: (first, middle, last) -> first <= middle <= last

		createTasks: (tasks, startDate, containerHeight, offset) =>
			gridX = @view.grid.x
			elements = []

			for task, idx in tasks
				size = 5
				date = moment.unix task.date
				daysSinceStart = date.diff(startDate, "days") + offset
				task_left = daysSinceStart * gridX

				for n in [0...idx]
					nextTask = tasks[n]

					if nextTask.date is task.date
						if size + 2 < containerHeight and size + 2 < gridX
							size += 2
						idx = n
					else
						break

				task_top = (containerHeight / 2) - (size / 2)
				task_left = task_left + (gridX / 2) - (size / 2)

				elements.push "<div class='jg-task' data-id='#{idx}'
						style='left:#{task_left}px; height:#{size}px; width:#{size}px; top:#{task_top}px'>
						</div>"

			elements.join ""

	$.fn[pluginName] = (data, options) ->
		@each ->
			unless $.data @, "plugin_#{pluginName}"
				$.data @, "plugin_#{pluginName}", new Gantt(@, data, options)
)(window.$ or window.jQuery or window.Zepto, window)
