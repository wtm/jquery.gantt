$(document).ready(function() {
  var stories = [{
    id: 1,
    name: "DEMO & Brainstorms Launch",
    iconURL: "https://d3iqftjt1wcsda.cloudfront.net/uploads/5f33e0/21a941/0fb65b/preview/Screen_Shot_2012-12-03_at_3.38.39_PM_47945.png?1354577942",
    startDate: "December 5, 2012",
    endDate: "December 12, 2012",
    color: "blue"
  }]
  $(".sg-container").svgGantt(stories);
})