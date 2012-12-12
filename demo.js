$(document).ready(function() {
  var storyCount = 900,
      colors = ["red", "green", "brown", "purple", "pink", "orange"],
      months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      stories = [];

  // Create some fake data
  for(i=0;i<storyCount;i++) {
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
        tasks = [],
        date = null;

    for(j=0;j<taskCount;j++) {
      date = moment(startDate).add("days", Math.floor(Math.random() * days));
      task = {
        date: date.format("MMMM D, YYYY")
      }
      tasks.push(task)
    }

    // Create the actual story object
    story = {
      id: i,
      name: "DEMO ",
      iconURL: "images/nike-swoosh.gif",
      startDate: startDate,
      endDate: endDate,
      color: colors[Math.floor(Math.random()*colors.length)],
      tasks: tasks
    }
    stories.push(story);
  }
  $(".container").gantt(stories);

  $(".toolbelt a").on("click", function() {
    if($(this).hasClass("view")) {
      $(".container").trigger("gantt-changeView", $(this).attr("class").split(" ")[1]);
    } else {
      $(".container").trigger("gantt-collapse", $(this).attr("class"));
    }
  })
})