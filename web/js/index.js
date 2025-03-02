// anchor tag js
document.querySelectorAll('.info a').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();

        const targetId = this.getAttribute('href').substring(1); // Remove the '#' symbol
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.scrollIntoView({
                behavior: 'smooth',
            });
        }
    });
});

// function to show content in read more buttons
// const readmoreBtn = document.querySelector("#readmore")
// readmoreBtn.addEventListener('click', function(event) {
  
//   showContent()
// })
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
    "web/images/background1.jpg", 
    "web/images/background2.jpg", 
    "web/images/background3.jpg", 
  ];
  
  const texts = [
    {
      title: "R-RECs",
      description: "Transparent, Traceable, Trustworthy."
      // description: "Pioneering the future of sustainable energy, R-RECs is committed to driving decarbonization with minimal environmental impact."
    },
    {
      title: "R-RECs",
      description: "Transparent, Traceable, Trustworthy."
      // description: "Embracing sustainable energy solutions is not just a choice for R-RECs; it's a commitment to a healthier planet for generations to come."
    },
    {
      title: "R-RECs",
      description: "Transparent, Traceable, Trustworthy."
      // description: "Standing at the forefront of the renewable energy revolution, we are determined to reduce our carbon footprint while securing a brighter, cleaner future."
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
      <h1>${texts[currentImageIndex].title}</h1>
      <h2>${texts[currentImageIndex].description}</h2>
    `;
  }
//
//
const boardMembers = [
    {
        name: "John Doe",
        text: "Head of Engineering",
        imageSrc: "web/images/board/Mask-group1.png",
    },
    {
        name: "Jane Smith",
        text: "Head of Engineering",
        imageSrc: "web/images/board/Mask-group.png",
    },
    {
        name: "Bob Johnson",
        text: "Head of Engineering",
        imageSrc: "web/images/board/Mask-group2.png",
    },
    {
        name: "Sarah Adams",
        text: "Head of Engineering",
        imageSrc: "web/images/board/Mask-group3.png",
    },
    // Add more board members as needed
];

let currentBoardIndex = 0;
const boardCardGroupSizeLarge = 4; // Display four cards on larger screens
const boardCardGroupSizeSmall = 2; // Display two cards on smaller screens


function changeBoardMember(direction) {
    const boardCardGroupSize = window.innerWidth < 768 ? boardCardGroupSizeSmall : boardCardGroupSizeLarge;
    currentBoardIndex += direction;

    if (currentBoardIndex < 0) {
        currentBoardIndex = boardMembers.length - 1;
    } else if (currentBoardIndex >= boardMembers.length) {
        currentBoardIndex = 0;
    }

    const boardCards = document.querySelectorAll('.board-card');
    for (let i = 0; i < boardCards.length; i++) {
        const index = (currentBoardIndex + i) % boardMembers.length;
        const card = boardCards[i];
        const member = boardMembers[index];

        card.innerHTML = `
            <img src="${member.imageSrc}" alt="${member.name}">
            <h2>${member.name}</h2>
            <h4>${member.text}</h4>
        `;
    }
}

// Call the function on page load to show the initial set of board members
changeBoardMember(0);
