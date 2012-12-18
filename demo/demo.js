$(document).ready(function() {
  var projectCount = 500,
      colors = ["red", "green", "brown", "purple", "pink", "orange"],
      months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      data = { projects: [], tasks: [] };

  // Create some fake data
  for(i=0;i<projectCount;i++) {
    // Random start date
    var startYear = Math.floor(Math.random()*5) + 2009,
        startMonth = Math.floor(Math.random()*12),
        startDay = Math.ceil(Math.random()*28),

        // Random end dates
        endYear = startYear,
        endMonth = Math.floor(Math.random()*2) + startMonth,
        endDay = Math.ceil(Math.random()*28);

    // Compensate if month/day is in the next month/day/year
    if(endDay < startDay && startMonth == endMonth) {endMonth++;}
    if(endMonth > 11) {endMonth -= 12}
    if(endMonth < startMonth) {endYear++}

    // Create the date labels
    var startDate = months[startMonth] + " " + startDay + ", " + startYear,
        endDate = months[endMonth] + " " + endDay + ", " + endYear,

        // Create some tasks
        days = moment(startDate).diff(moment(endDate), "days"),
        taskCount = Math.floor(Math.random() * 30),
        color = colors[Math.floor(Math.random()*colors.length)],
        tasks = [],
        date = null;

    for(j=0;j<taskCount;j++) {
      date = moment(startDate).add("days", Math.random() * days).add("hours", 18);
      task = {
        date: date.format("MMMM D, YYYY")
      }
      tasks.push(task)
    }

    // Create the actual project object
    project = {
      id: i,
      name: "DEMO ",
      iconURL: "wtm.png",
      startDate: startDate,
      endDate: endDate,
      color: color,
      tasks: tasks
    }
    data.projects.push(project);
  }

  taskCount = (Math.random() * 500) + 1300;
  for(j=0;j<taskCount;j++) {
    date = moment("January 1, 2009").add("days", Math.random() * 1900);
    task = {
      date: date.format("MMMM D, YYYY")
    }
    data.tasks.push(task)
  }

  $(".container").gantt(data);

  $(".container .jg-task").on("mouseenter mouseleave", function() {
    console.log("Task hover, the ID is:", $(this).data("id"));
  })

  $('.controls .views a').on("click", function(e) {
    e.preventDefault();
    $(".container").trigger("gantt-changeView", $(this).attr("class"));
  });

  $('.controls .modes a').on("click", function(e) {
    e.preventDefault();
    $(".container").trigger("gantt-changeMode", $(this).attr("class"))
  });

  $('.controls .filters select').on("change", function(e) {
    e.preventDefault();
    filter = { color: $(this).val() }
    $(".container").trigger("gantt-filterBy", filter);
  });

  $('.controls .filters a').on("click", function(e) {
    e.preventDefault();
    $(".container").trigger("gantt-filterBy", null);
  });

  $('.controls .moveto a').on("click", function(e, date) {
    e.preventDefault();
    $(".container").trigger("gantt-moveto", null);
  });
})