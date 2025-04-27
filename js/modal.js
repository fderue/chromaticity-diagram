const modalDiv = document.createElement("div");
modalDiv.style.display = "none";
modalDiv.style.position = "fixed";
modalDiv.style.zIndex = 20;
//modalDiv.style.paddingTop = "100px";
modalDiv.style.left = 0;
modalDiv.style.top = 0;
modalDiv.style.width = "100%";
modalDiv.style.height = "100%";
modalDiv.style.backgroundColor = "rgba(0, 0, 0, 0.5)";

const modalContentDiv = document.createElement("div");
modalContentDiv.style.position = "absolute";
modalContentDiv.style.width = "90%";
//modalContentDiv.height = "100%";
modalContentDiv.style.color = "rgba(0, 0, 0, 0)";
modalContentDiv.style.top = "50%";
modalContentDiv.style.left = "50%";
modalContentDiv.style.transform = "translate(-50%, -50%)";
modalContentDiv.style.boxShadow = "0px 0px 10px rgba(0, 0, 0, 1)";


const image = document.createElement("img");
modalContentDiv.append(image);

modalDiv.append(modalContentDiv);
document.body.append(modalDiv);

function popupInModal(img) {
  image.src = img.src;
  modalDiv.style.display = "block";
  //alert(image.src);
}

window.onclick = function (event) {
  if (event.target == modalDiv) {
    modalDiv.style.display = "none";
  }
};
