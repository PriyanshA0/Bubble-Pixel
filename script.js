window.onload = () => {
    const logo = document.getElementById("logo");
  
    // Trigger scale-in animation
    setTimeout(() => {
      logo.style.transform = "scale(1.5)";
    }, 100);
  
    // Redirect to login screen in nested folder
    setTimeout(() => {
      window.location.href = "screen/Bubble_Pixel.html";
    }, 2000);
  };
  