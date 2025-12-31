# 🏡 RoamHaven

**RoamHaven** is a full-stack web application for discovering and booking unique accommodations around the world. Built with modern web technologies, it offers a seamless experience for travelers to find their perfect stay and for hosts to list their properties.

[![Node.js](https://img.shields.io/badge/Node.js-18.18.0-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-5.1.0-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

---

## ✨ Features

### 🏠 **Modern UI/UX**
- **Airbnb-Style Design**: Stunning new interface with rounded cards, sticky booking summary, and clean typography
- **Responsive Layout**: Fully optimized 2-column layout that adapts to all devices
- **Interactive Elements**: Image galleries, heart favorites, and animated buttons

### 🤖 **Smart AI Features**
- **RoamMate Chatbot**: Intelligent rule-based assistant that searches the database for listings, checks prices, and answers queries (No API key required!)
- **AI Trip Planner**: Generates personalized 3-day itineraries for any listing using Google Gemini (with smart fallback)
- **Natural Language**: Chatbot understands complex queries like "Show me places in Nashik under 5000"

### � **Core Functionality**
- **Listing Management**: Create, edit, delete listings with Cloudinary image upload
- **Secure Auth**: User registration & login with Passport.js encryption
- **Booking System**: Complete booking flow from request to payment logic
- **Reviews & Ratings**: Detailed 5-star rating system with breakdown metrics

### �🗺️ **Location Services**
- **Geocoding**: Automatic coordinate generation for new listings
- **Interactive Maps**: Dynamic maps on listing pages showing exact property location
- **Location Search**: Find properties by city or region

---

## 🛠️ Tech Stack

### **Backend**
- **Node.js** (v18.18.0) - Runtime environment
- **Express.js** (v5.1.0) - Web framework
- **MongoDB** - Database (with Mongoose ODM)
- **Passport.js** - Authentication middleware

### **Frontend**
- **EJS** - Template engine
- **EJS Mate** - Layout support
- **CSS** - Custom styling

### **Cloud Services**
- **Cloudinary** - Image storage and management
- **MongoDB Atlas** - Cloud database hosting

### **APIs & Integrations**
- **Google Generative AI** - AI chatbot functionality
- **OpenCage Geocoder** - Location services
- **Axios** - HTTP client

### **Security & Validation**
- **Joi** - Schema validation
- **express-session** - Session management
- **connect-flash** - Flash messages
- **passport-local-mongoose** - User authentication

---

## 📋 Prerequisites

Before running this application, make sure you have:

- **Node.js** (v18.18.0 or higher)
- **MongoDB** (local installation or Atlas account)
- **npm** or **yarn** package manager

---

## 🚀 Installation & Setup

### 1️⃣ **Clone the Repository**

```bash
git clone https://github.com/akshatraikar11/RoamHaven.git
cd RoamHaven
```

### 2️⃣ **Install Dependencies**

```bash
npm install
```

### 3️⃣ **Environment Configuration**

Create a `.env` file in the root directory and add the following variables:

```env
# MongoDB Configuration
ATLASDB_URL=your_mongodb_atlas_connection_string

# Session Secret
SECRET=your_session_secret_key

# Cloudinary Configuration
CLOUD_NAME=your_cloudinary_cloud_name
CLOUD_API_KEY=your_cloudinary_api_key
CLOUD_API_SECRET=your_cloudinary_api_secret

# OpenCage Geocoding API
OPENCAGE_API_KEY=your_opencage_api_key

# Node Environment
NODE_ENV=development
```

### 4️⃣ **Initialize Database (Optional)**

To populate the database with sample data:

```bash
npm run init-db
```

### 5️⃣ **Start the Application**

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The application will be available at: **http://localhost:8080**

---

## 📁 Project Structure

```
RoamHaven/
├── controllers/          # Route controllers
│   ├── bookings.js
│   ├── listings.js
│   ├── reviews.js
│   └── users.js
├── models/              # Database models
│   ├── booking.js
│   ├── listing.js
│   ├── review.js
│   └── user.js
├── routes/              # Express routes
│   ├── bookings.js
│   ├── listing.js
│   ├── review.js
│   └── user.js
├── views/               # EJS templates
│   ├── bookings/
│   ├── listings/
│   ├── users/
│   ├── includes/
│   ├── layouts/
│   └── partials/
├── public/              # Static assets
│   ├── css/
│   ├── js/
│   └── images/
├── utils/               # Utility functions
│   ├── ExpressError.js
│   ├── geocoder.js
│   └── wrapAsync.js
├── init/                # Database initialization
│   ├── data.js
│   └── index.js
├── middleware.js        # Custom middleware
├── schema.js           # Joi validation schemas
├── cloudConfig.js      # Cloudinary configuration
├── app.js              # Main application file
├── package.json        # Dependencies
└── .env                # Environment variables (not tracked)
```

---

## 🔐 Security Features

- ✅ **Environment Variables** - Sensitive data stored securely
- ✅ **Password Hashing** - Using passport-local-mongoose
- ✅ **Session Management** - Secure session handling with MongoDB store
- ✅ **Input Validation** - Server-side validation with Joi
- ✅ **CSRF Protection** - Method override for secure form submissions
- ✅ **HTTP-only Cookies** - Protection against XSS attacks

---

## 🎯 API Endpoints

### **Listings**
- `GET /listings` - View all listings
- `GET /listings/new` - Show create listing form
- `POST /listings` - Create new listing
- `GET /listings/:id` - View single listing
- `GET /listings/:id/edit` - Show edit form
- `PUT /listings/:id` - Update listing
- `DELETE /listings/:id` - Delete listing

### **Reviews**
- `POST /listings/:id/reviews` - Add review
- `DELETE /listings/:id/reviews/:reviewId` - Delete review

### **Users**
- `GET /signup` - Show signup form
- `POST /signup` - Register new user
- `GET /login` - Show login form
- `POST /login` - Login user
- `GET /logout` - Logout user

### **Bookings**
- `GET /bookings` - View all bookings
- `POST /bookings` - Create new booking

### **AI Assistant**
- `POST /api/jarvis` - Chat with AI assistant

---

## 🧪 Scripts

```bash
# Start production server
npm start

# Start development server with auto-reload
npm run dev

# Initialize database with sample data
npm run init-db

# Run tests (not configured yet)
npm test
```

---

## 🌟 Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^5.1.0 | Web framework |
| mongoose | ^8.19.2 | MongoDB ODM |
| passport | ^0.7.0 | Authentication |
| cloudinary | ^1.30.0 | Image management |
| ejs | ^3.1.10 | Template engine |
| joi | ^17.13.3 | Validation |
| @google/generative-ai | ^0.24.1 | AI chatbot |
| node-geocoder | ^4.4.1 | Geocoding |

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the **ISC License**.

---

## 👨‍💻 Author

**Akshat Raikar**

- GitHub: [@akshatraikar11](https://github.com/akshatraikar11)
- Project Link: [https://github.com/akshatraikar11/RoamHaven](https://github.com/akshatraikar11/RoamHaven)

---

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) - Fast, unopinionated web framework
- [MongoDB](https://www.mongodb.com/) - NoSQL database
- [Cloudinary](https://cloudinary.com/) - Image and video management
- [Passport.js](http://www.passportjs.org/) - Authentication middleware
- [OpenCage](https://opencagedata.com/) - Geocoding API
- [Google Generative AI](https://ai.google.dev/) - AI capabilities

---

## 📞 Support

If you have any questions or need help, please:
- Open an issue on GitHub
- Contact the maintainer

---

<div align="center">
  <p>Made with ❤️ by Akshat Raikar</p>
  <p>⭐ Star this repository if you found it helpful!</p>
</div>
