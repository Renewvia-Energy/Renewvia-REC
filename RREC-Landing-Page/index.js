// function to show content in read more buttons
function showContent(contentId) {
    var content = document.getElementById(contentId);
    
    // Hide all hidden-text in all cards
    var hiddenTexts = document.querySelectorAll('.hidden-text');
    hiddenTexts.forEach(function(text) {
      text.style.display = 'none';
    });
  
    // Show the hidden text in the clicked card
    content.style.display = 'block';
  }
  
  function hideContent(contentId) {
    var content = document.getElementById(contentId);
    
    // Hide the hidden text
    content.style.display = 'none';
    
  }
//
//
// js for the carousel hero section

const images = [
    "/images/background1.jpg", 
    "/images/background2.jpg", 
    "/images/background3.jpg", 
  ];
  
  const texts = [
    {
      title: "R-RECs",
      description: "Promoting renewable energy, empowering minigrids in Africa, and ensuring transparency and fairness in the carbon asset market."
    },
    {
      title: "R-RECs",
      description: "R-RECS efforts aim to drive sustainable development and reduce carbon emissions."
    },
    {
      title: "R-RECs",
      description: "Fostering renewable energy and empowering local communities with minigrids, our initiative seeks to create a more equitable and eco-friendly energy landscape."
    }
  ];
  
  let currentImageIndex = 0;
  
  function changeImage(direction) {
    currentImageIndex += direction;
  
    // Wrap around if we go beyond the first or last image
    if (currentImageIndex < 0) {
      currentImageIndex = images.length - 1;
    } else if (currentImageIndex >= images.length) {
      currentImageIndex = 0;
    }
  
    // Get the image element and text container
    const imageElement = document.querySelector(".image-carousel img");
    const textContainer = document.querySelector(".text");
  
    // Update the image source and associated text
    imageElement.src = images[currentImageIndex];
    textContainer.innerHTML = `
      <div>${texts[currentImageIndex].title}</div>
      <br />
      <p>${texts[currentImageIndex].description}</p>
    `;
  }
//
//