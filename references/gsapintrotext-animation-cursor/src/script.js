// INTRO
var introTL = gsap.timeline();
introTL.to(".intro", .1, {fontFamily: "Anton"})
introTL.to(".intro", .1, {fontFamily: "Jost"})
introTL.to(".intro", .1, {fontFamily: "Alkatra"})
introTL.to(".intro", .1, {fontFamily: "Nova Oval"})
introTL.to(".intro", .1, {fontFamily: "Oswald"})
introTL.to(".intro", .1, {fontFamily: "PT Serif"})
introTL.to(".intro", .1, {fontFamily: "Lexend"})
introTL.to(".intro", .1, {fontFamily: "Poppins"})
introTL.to(".intro", .1, {fontFamily: "Titillium Web"})
introTL.to(".intro", 1, {scaleY: 0, ease:"expo.inOut"})
introTL.to(".intro__red", 1, {scaleY: 2, ease:"expo.inOut"}, "-=1.25")

// TITLE
function separateWordsAndLetters(text) {
  let words = text.split(/\s+|<br>/);
  let result = "";
  for (let i = 0; i < words.length; i++) {
    let word = words[i];
    result += "<div class='flex'>";
    for (let j = 0; j < word.length; j++) {
      result += "<span>" + word[j] + "</span>";
    }
    result += "</div>&nbsp;";
  }
  return result;
}

var clipH1 = document.querySelector(".clip h1")
let separatedClipH1 = separateWordsAndLetters(clipH1.innerHTML);
clipH1.innerHTML = separatedClipH1;
var clipH1Letters = document.querySelectorAll(".clip h1 span")
gsap.set(clipH1Letters, {y: "120%", scale: -.5})
gsap.to(clipH1Letters, {duration: 1.5, y: "10%", scale: 1, ease: "expo.inOut", delay: 0.6, stagger: 0.025})

var clipH1Stroke = document.querySelector(".clip .h1__stroke")
let separatedClipH1Stroke = separateWordsAndLetters(clipH1Stroke.innerHTML);
clipH1Stroke.innerHTML = separatedClipH1Stroke;
var clipH1StrokeLetters = document.querySelectorAll(".clip .h1__stroke span")
gsap.set(clipH1StrokeLetters, {y: "120%", scale: -.5})
gsap.to(clipH1StrokeLetters, {duration: 1.5, y: "10%", scale: 1, ease: "expo.inOut", delay: 0.6, stagger: 0.025})

//CURSOR
var cursor = document.querySelector(".cursor")

document.querySelector(".clip__inner").addEventListener("mousemove", (e) => {
  var x = e.clientX
  var y = e.clientY

  gsap.to(".cursor", .5, {duration: 0, x: x, y: y})
})

document.querySelector(".clip__inner").addEventListener("mouseenter", () => {
  gsap.to(".cursor", .5, {scale: 1, ease: "expo.inOut"})
})

document.querySelector(".clip__inner").addEventListener("mouseleave", () => {
  gsap.to(".cursor", .5, {scale: 0, ease: "expo.inOut"})
})