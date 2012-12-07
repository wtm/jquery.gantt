$(document).ready(function() {

  var storyCount = 200,
      stories = [],
      months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  for(i=0;i<storyCount;i++) {
    startYear = endYear = 2012;
    startMonth = Math.ceil(Math.random()*12) - 1;
    startDay = Math.ceil(Math.random()*12);
    endDay = Math.ceil(Math.random()*12) + startDay;
    endMonth = startMonth + Math.floor(Math.random()*2);
    startDate = months[startMonth] + " " + startDay + ", " + startYear;
    endDate = months[endMonth] + " " + endDay + ", " + endYear;

    if(endMonth < startMonth) { endYear++ }
    story = {
      id: i,
      name: "DEMO & Brainstorms Launch",
      iconURL: "https://d3iqftjt1wcsda.cloudfront.net/uploads/5f33e0/21a941/0fb65b/preview/Screen_Shot_2012-12-03_at_3.38.39_PM_47945.png?1354577942",
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