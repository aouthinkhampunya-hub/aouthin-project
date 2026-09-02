// ໄຟລ໌ນີ້ໃຊ້ Highlight ປຸ່ມ nav ໃຫ້ເປັນສີຂຽວ ຕາມໜ້າທີ່ເຮົາຢູ່ປັດຈຸບັນ
document.addEventListener("DOMContentLoaded", () => {
    const currentPage = window.location.pathname.split("/").pop(); // ເອົາຊື່ໄຟລ໌ປັດຈຸບັນ ເຊັ່ນ "orders.html"
    const navLinks = document.querySelectorAll("nav a");
  
    navLinks.forEach(link => {
      const linkPage = link.getAttribute("href");
      if (linkPage === currentPage) {
        link.classList.add("active");
      }
    });
  });