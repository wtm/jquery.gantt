$(document).ready(function() {
  $('.filter button').on("click", function() {
    $(this).siblings(".active").removeClass("active");
    $(this).addClass("active");
  })
})