$(document).ready(function() {

  var storyCount = 120,
      stories = [],
      months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  for(i=0;i<storyCount;i++) {
    startYear = endYear = 2012;
    startMonth = Math.floor(Math.random()*12);
    startDay = Math.ceil(Math.random()*12);
    endDay = Math.ceil(Math.random()*12) + 12;
    endMonth = Math.floor(Math.random()*2) + startMonth;
    if(endMonth > 11) {endMonth -= 12}
    if(endMonth < startMonth) {endYear++}
    startDate = months[startMonth] + " " + startDay + ", " + startYear;
    endDate = months[endMonth] + " " + endDay + ", " + endYear;
    console.log(endDate, endMonth)

    if(endMonth < startMonth) { endYear++ }
    story = {
      id: i,
      name: "DEMO ",
      iconURL: "nike-swoosh.gif",
      startDate: startDate,
      endDate: endDate,
      color: "blue"
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