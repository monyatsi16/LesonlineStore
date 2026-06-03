# Chapter 4: System Design and Implementation

## System Design

The LesOnline system is a full-stack marketplace and dynamic pricing platform. The design emphasizes separation of concerns between the frontend user interface, backend server, business logic, pricing intelligence, and persistent storage.

Key design components:
- **Frontend (client)**: A React application built with Vite and Tailwind CSS. This layer provides the marketplace storefront, seller dashboard, admin tools, product pages, cart, checkout, and order tracking.
- **Backend (server)**: An Express.js server written in TypeScript. The backend exposes REST API routes for marketplace browsing, orders, product management, pricing recommendations, analytics, and administration.
- **Database**: PostgreSQL with Drizzle ORM and Neon-compatible serverless support. The database stores users, products, orders, pricing recommendations, sales data, and scheduler logs.
- **Pricing Engine**: A custom gradient boosting model that generates price recommendations based on market position, brand patterns, demand signals, stock, and historical pricing data.
- **Scheduler**: A periodic background service that automatically evaluates product prices and stores update logs.

The architecture ensures the browser only interacts with the backend through secure API calls. The frontend does not embed business logic, and the backend does not contain presentation details.

### Deployment and Run Design

The system is designed to run from a Node.js environment. In development, the backend uses Vite middleware to serve the React app and handle API requests on the same server. In production, the backend can serve static built assets and run the model scheduler and email delivery services.

The design also supports role-based access control:
- **Admin**: Full access to platform analytics, pricing runs, user and product management.
- **Retailer**: Seller access to product management, prices, and order history.
- **Buyer**: Public marketplace access with checkout and order tracking.

## Testing Objectives

Testing objectives define what the system must achieve and validate before release.

Primary testing objectives for LesOnline are:
1. **Functionality**: Verify marketplace browsing, search, cart, checkout, seller management, admin controls, and pricing recommendation flows work as intended.
2. **Reliability**: Ensure orders are created correctly, inventory is updated safely, and scheduled pricing updates do not corrupt data.
3. **Usability**: Confirm the marketplace is intuitive and the checkout flow is easy for buyers, sellers, and admin users.
4. **Security**: Validate authentication, authorization, and data handling are properly enforced.
5. **Performance**: Monitor application responsiveness under normal use, especially checkout and product search.

## Testing Methods

Three testing methods were chosen for this project:

1. **Unit Testing** (optional / recommended when available)
   - Validate individual functions and modules such as payment normalization, order creation logic, and pricing model utilities.
   - Use mock inputs to confirm correct behavior at the smallest code level.

2. **Integration Testing**
   - Test how multiple components work together, including the backend API, database transactions, frontend interactions, and the pricing scheduler.
   - Confirm that data flows correctly from the user interface through the server to the database and back.

3. **Usability Testing** (required)
   - Observe real or representative users while they browse products, add items to cart, and complete checkout.
   - Assess whether the UI is easy to understand, search results are meaningful, and the order confirmation experience is clear.

## Test Plan

The test plan establishes the scope, test cases, and expected results.

### Scope
- Marketplace browsing and search
- Product detail display
- Cart and checkout flows
- Order creation and tracking
- Seller dashboard workflows
- Admin pricing and analytics pages
- Basic security and access control

### Test Environment
- Node.js 20 or later
- Local PostgreSQL or Neon database
- Browser for user interface tests
- Sample data seeded into database

### Test Execution
- Run the backend locally using `npm run dev`
- Use the browser to verify UI flows
- Use API tools (Postman, curl) to validate endpoints if needed
- Record results, issues, and fixes

## Test Case

### Test Case 1: Product Browsing
- **Objective**: Confirm buyers can see products, search, and filter by category.
- **Steps**:
  1. Open the homepage.
  2. Browse product listings.
  3. Enter a search query.
  4. Select a category filter.
- **Expected Result**: Products display correctly and search results match the query.

### Test Case 2: Product Detail
- **Objective**: Verify individual product pages show full details.
- **Steps**:
  1. Click a product from the list.
  2. View description, price, stock, and images.
  3. Add quantity to the cart.
- **Expected Result**: Product details appear accurately and the add-to-cart action works.

### Test Case 3: Checkout and Order Creation
- **Objective**: Ensure checkout creates an order and updates stock.
- **Steps**:
  1. Add items to cart.
  2. Proceed to checkout.
  3. Enter buyer details and select a payment method.
  4. Submit the order.
- **Expected Result**: Order is created, stock is decremented, and confirmation is returned.

### Test Case 4: Seller Dashboard Access
- **Objective**: Confirm a retailer can log in and view their product/orders.
- **Steps**:
  1. Sign in on `/auth` as a retailer.
  2. Visit `/dashboard`.
  3. View product list and sales analytics.
- **Expected Result**: Seller data loads and access is granted.

### Test Case 5: Admin Pricing Run
- **Objective**: Verify the admin can run pricing and view logs.
- **Steps**:
  1. Sign in as admin.
  2. Navigate to admin pricing controls.
  3. Trigger a pricing run or inspect scheduler history.
- **Expected Result**: Pricing details appear and new logs update appropriately.

## Integration Testing and Results

### Method
Integration testing focused on end-to-end flows across the frontend, backend, and database. Key API endpoints were exercised in the same environment as the UI.

### Results
- **Marketplace flow**: Successful. Product listings loaded, search worked, and product details rendered correctly.
- **Checkout flow**: Successful. Orders were created and stock levels updated in the database.
- **Seller dashboard**: Successful. Seller-only routes returned valid product and order data when authenticated.
- **Admin controls**: Successful. Admin API and UI flows displayed platform statistics and pricing update logs.

### Notes
- No external payment gateway is integrated, so `card` payment is currently treated as a local selection rather than real card authorization.
- Database transaction logic handled stock updates correctly, preventing oversell during checkout.

## Usability Testing and Results

### Method
Usability testing was performed by walking through the main user journeys with one or more representative users or stakeholders. The focus was on clarity, ease of navigation, and whether users could complete key tasks without assistance.

### Results
- **Home and browsing**: Users found the marketplace layout clear and product cards easy to scan.
- **Search and filtering**: Search results were intuitive, and category selection helped narrow down products effectively.
- **Checkout**: The multi-step checkout was straightforward. Payment options were visible, though users noticed `card` appears as a method without actual gateway integration.
- **Order tracking**: Users could locate the order confirmation page and understand next steps.
- **Seller/admin screens**: These views were functional but contain more information; some users recommended clearer labeling for advanced metrics.

### Conclusion
Usability was acceptable for buyers and functional users. The primary improvement area is clearer communication around payment options and the difference between payment methods.

# System Implementation

## Implementation

The system implementation brings together the frontend, backend, and database into a working application.

### Frontend Implementation
- Built with React and Vite.
- Uses Tailwind CSS for styling and responsive design.
- Implements buyer, seller, and admin pages using client-side routing.
- Uses `fetch` and API calls to interact with the backend.

### Backend Implementation
- Built with Express.js and TypeScript.
- Provides REST routes for marketplace, orders, users, analytics, pricing, and admin operations.
- Uses Passport.js for authentication and express-session for session management.
- Handles API validation, database transactions, and background pricing jobs.

### Database Implementation
- PostgreSQL via Drizzle ORM.
- Tables for users, products, orders, recommendations, sales data, and logs.
- Supports role-based data access and transaction-safe order creation.

## Implementation Security

Security considerations applied during implementation:
- **Authentication and authorization**: Login and role checks on protected routes, ensuring admins and sellers cannot be accessed by unauthorized users.
- **Input normalization**: Payment methods, order fields, and request payloads are validated and normalized before use.
- **Session management**: Uses secure session cookies via Express sessions.
- **Error handling**: Server responds with safe error messages and logs internal details without exposing sensitive data.
- **Static file serving**: Only built frontend assets are served in production mode.

## Performance Monitoring

The system includes monitoring strategies to ensure acceptable performance:
- **Scheduler logs**: The price scheduler records how many products were analyzed and updated on each run.
- **Health endpoint**: A system health route returns status for the database, scheduler, and model readiness.
- **Frontend responsiveness**: The client is optimized for fast loading through Vite bundling and cached static assets.
- **Database efficiency**: Queries use indexed tables and transactions for order flow to reduce concurrency issues.

## Support

Support for the system includes:
- **Documentation**: User manual and system documentation provide guidance for buyers, sellers, and administrators.
- **Error logging**: Backend logs errors to the console for diagnosis.
- **Configuration**: Environment variables control database connection, scheduler behavior, and model training settings.
- **Maintenance**: The system can be updated by adjusting schema definitions, seeding data, and adding new routes.

# Chapter 5: Conclusion

## Summary
LesOnline is a modern marketplace platform that combines product browsing, seller management, and automated pricing intelligence. The system design separates the frontend UI from backend business logic and persistence, enabling better maintainability and scalability.

The implementation successfully supports buyer workflows, seller dashboards, and admin oversight. Usability testing confirmed that the marketplace experience is clear, while integration testing verified that orders, stock management, and pricing flows work end to end.

## Recommendations and Future Work

Recommended future improvements include:
1. **Payment gateway integration**: Add a real payment provider such as Stripe, PayPal, or a local bank transfer gateway so `card` payments are processed securely.
2. **Enhanced usability**: Improve the checkout experience by clarifying payment options and adding progress indicators.
3. **Analytics dashboards**: Expand admin and seller analytics with more visual reports and trend analysis.
4. **Security hardening**: Add HTTPS, stronger session safeguards, rate limiting, and CSRF protection.
5. **Automated tests**: Introduce unit tests and integration tests to support continuous quality assurance.

## References

- Project source code and architecture from the LesOnline repository.
- Express.js documentation: https://expressjs.com
- React documentation: https://react.dev
- Vite documentation: https://vitejs.dev
- Drizzle ORM documentation: https://orm.drizzle.team
- Passport.js documentation: http://www.passportjs.org/
- PostgreSQL documentation: https://www.postgresql.org

## Appendix

### System User Manual (Usability)

Refer to `USER_MANUAL.md` for the full user manual and usability guidance. It includes instructions for buyers, sellers, admins, setup, and supported workflows.

### Additional Appendix Information

- **System architecture summary**: Frontend React app + backend Express API + PostgreSQL database + pricing scheduler.
- **Supported user roles**: Buyer, Retailer, Administrator.
- **Known limitation**: No external card payment gateway is currently integrated; `card` payment is a local selection only.
- **Environment variables**: `PORT`, `NODE_ENV`, `DATABASE_URL`, `SESSION_SECRET`, and pricing/scheduler settings.
