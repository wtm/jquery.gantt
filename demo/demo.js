$(document).ready(function() {
  var stories = [{
    id: 1,
    name: "DEMO & Brainstorms Launch",
    iconURL: "https://d3iqftjt1wcsda.cloudfront.net/uploads/5f33e0/21a941/0fb65b/preview/Screen_Shot_2012-12-03_at_3.38.39_PM_47945.png?1354577942",
    startDate: "December 5, 2012",
    endDate: "December 20, 2012",
    color: "blue"
  },{
    id: 2,
    name: "DEMO & Brainstorms Launch",
    iconURL: "https://d3iqftjt1wcsda.cloudfront.net/uploads/5f33e0/21a941/0fb65b/preview/Screen_Shot_2012-12-03_at_3.38.39_PM_47945.png?1354577942",
    startDate: "December 4, 2012",
    endDate: "December 10, 2012",
    color: "red"
  },{
    id: 1,
    name: "DEMO & Brainstorms Launch",
    iconURL: "https://d3iqftjt1wcsda.cloudfront.net/uploads/5f33e0/21a941/0fb65b/preview/Screen_Shot_2012-12-03_at_3.38.39_PM_47945.png?1354577942",
    startDate: "December 8, 2012",
    endDate: "December 9, 2012",
    color: "blue"
  },{
    id: 2,
    name: "DEMO & Brainstorms Launch",
    iconURL: "https://d3iqftjt1wcsda.cloudfront.net/uploads/5f33e0/21a941/0fb65b/preview/Screen_Shot_2012-12-03_at_3.38.39_PM_47945.png?1354577942",
    startDate: "December 3, 2012",
    endDate: "December 5, 2012",
    color: "red"
  },{
    id: 2,
    name: "DEMO & Brainstorms Launch",
    iconURL: "https://d3iqftjt1wcsda.cloudfront.net/uploads/5f33e0/21a941/0fb65b/preview/Screen_Shot_2012-12-03_at_3.38.39_PM_47945.png?1354577942",
    startDate: "December 12, 2012",
    endDate: "December 19, 2012",
    color: "red"
  },{
    id: 2,
    name: "DEMO & Brainstorms Launch",
    iconURL: "https://d3iqftjt1wcsda.cloudfront.net/uploads/5f33e0/21a941/0fb65b/preview/Screen_Shot_2012-12-03_at_3.38.39_PM_47945.png?1354577942",
    startDate: "December 10, 2012",
    endDate: "December 13, 2012",
    color: "red"
  }]
  $(".container").svgGantt(stories, {currentDate: "December 1, 2012"});

  $(".toolbelt a").on("click", function() {
    if($(this).hasClass("view")) {
      $(".container").trigger("gantt-changeView", $(this).attr("class"));
    } else {
      $(".container").trigger("gantt-collapse", $(this).attr("class"));
    }
  })
})