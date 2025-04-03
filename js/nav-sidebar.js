

function fillNavigationListWithHeaders(){
  const menu = document.getElementById("sidebar-menu");
  const sections = document.querySelectorAll("section[id]");
  sections.forEach((section)=>{
    // Find header content
    const header = section.querySelector("h2, h3");
    const listItem = document.createElement("li");
    if(header.tagName == "H3"){
      listItem.style.marginLeft = "12px";
      listItem.style.fontSize = "80%";
    }

    const itemRef = document.createElement("a");
    itemRef.href = `#${section.id}`;
    itemRef.textContent = header.textContent;
    listItem.append(itemRef);
    menu.append(listItem);
  });
}

function addActiveClassIfOnScreen(){
  window.addEventListener('DOMContentLoaded', () => {

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const id = entry.target.getAttribute('id');
        if (entry.intersectionRatio > 0) {
          document.querySelector(`li a[href="#${id}"]`).parentElement.classList.add('active');
        } else {
          document.querySelector(`li a[href="#${id}"]`).parentElement.classList.remove('active');
        }
      });
    });
  
    // Track all sections that have an `id` applied
    document.querySelectorAll('section[id]').forEach((section) => {
      observer.observe(section);
    });
    
  });
}

fillNavigationListWithHeaders();
addActiveClassIfOnScreen();

