

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  size VARCHAR(50),
  color VARCHAR(50),
  stock INT DEFAULT 0,
  image VARCHAR(500)
);

CREATE TABLE bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
     table_number VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  customer_phone VARCHAR(50),
  customer_address VARCHAR(500),
  slip_image VARCHAR(500),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (bill_id) REFERENCES bills(id)
);

CREATE TABLE admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) DEFAULT 'staff'
);

CREATE TABLE settings (
  `key` VARCHAR(100) PRIMARY KEY,
  value TEXT
);

CREATE TABLE staff_calls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_number VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
