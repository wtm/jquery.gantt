$(document).ready(function() {

  var storyCount = 200,
      stories = [],
      colors = ["blue", "red", "yellow", "green", "brown", "purple", "pink", "orange"],
      months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  for(i=0;i<storyCount;i++) {
    startYear = endYear = Math.floor(Math.random()*5) + 2009;
    startMonth = Math.floor(Math.random()*12);
    startDay = Math.ceil(Math.random()*28);
    endDay = Math.ceil(Math.random()*28);
    endMonth = Math.floor(Math.random()*2) + startMonth;
    if(endDay < startDay && startMonth == endMonth) {endMonth++;}
    if(endMonth > 11) {endMonth -= 12}
    if(endMonth < startMonth) {endYear++}
    startDate = months[startMonth] + " " + startDay + ", " + startYear;
    endDate = months[endMonth] + " " + endDay + ", " + endYear;

    if(endMonth < startMonth) { endYear++ }
    tasks = [];
    days = moment(startDate).diff(moment(endDate), "days");

    taskCount = Math.floor(Math.random() * 30)
    for(j=0;j<taskCount;j++) {
      task = {
        date: moment(startDate).add("days", Math.floor(Math.random() * days)).format("MMMM D, YYYY")
      }
      tasks.push(task)
    }

    story = {
      id: i,
      name: "DEMO ",
      iconURL: "nike-swoosh.gif",
      startDate: startDate,
      endDate: endDate,
      color: colors[Math.floor(Math.random()*7)],
      tasks: tasks
    }
    stories.push(story);
  }
  $(".container").svgGantt(stories, {currentDate: "December 1, 2012"});

  $(".toolbelt a").on("click", function() {
    if($(this).hasClass("view")) {
      $(".container").trigger("gantt-changeView", $(this).attr("class").split(" ")[1]);
    } else {
      $(".container").trigger("gantt-collapse", $(this).attr("class"));
    }
  })
})