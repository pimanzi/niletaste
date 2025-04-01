// Authentication state
let currentUser = null;
let authCheckInProgress = true; // Add this flag to track auth check status

// Restaurant data
let restaurants = []; // Will be populated from Supabase
let isLoading = true;

// Pagination variables
let currentPage = 1;
const restaurantsPerPage = 6;

// Authentication Functions
async function showLoginModal() {
  document.getElementById('loginModal').classList.remove('hidden');
  document.getElementById('loginModal').classList.add('flex');
}

async function showRegisterModal() {
  document.getElementById('registerModal').classList.remove('hidden');
  document.getElementById('registerModal').classList.add('flex');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('flex');
  document.getElementById(modalId).classList.add('hidden');
}

// Login user with Supabase
async function loginUser({ email, password }) {
  const { data, error } = await window.supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

// Get current user from Supabase
async function getUser() {
  const { data, error } = await window.supabaseClient.auth.getUser();

  if (error) {
    console.error('Error getting user:', error);
    return null;
  }

  return data?.user || null;
}

// Logout user
async function logoutUser() {
  const { error } = await window.supabaseClient.auth.signOut();

  if (error) {
    console.error('Error logging out:', error);
    Swal.fire({
      icon: 'error',
      title: 'Logout Failed',
      text: error.message,
      confirmButtonColor: '#10B981',
    });
    throw error;
  }

  currentUser = null;
  updateUIForLoggedInUser();
  displayRestaurants();

  // Show logout success toast
  Swal.fire({
    position: 'top-end',
    icon: 'success',
    title: 'Logged out successfully!',
    showConfirmButton: false,
    timer: 1500,
    toast: true,
  });
}

// Handle login form submission
async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const { data, error } = await window.supabaseClient.auth.signInWithPassword(
      {
        email,
        password,
      }
    );

    if (error) throw error;

    // Fetch additional user data if needed
    const { data: userData, error: userError } = await window.supabaseClient
      .from('authUsers')
      .select('*')
      .eq('authId', data.user.id)
      .single();

    currentUser = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name || userData?.name || '',
      phone: data.user.user_metadata?.phone || userData?.phone || '',
    };

    closeModal('loginModal');
    updateUIForLoggedInUser();
    displayRestaurants();
    document.getElementById('loginForm').reset();

    // Show success toast
    Swal.fire({
      position: 'top-end',
      icon: 'success',
      title: 'Login successful!',
      showConfirmButton: false,
      timer: 2000,
      toast: true,
    });
  } catch (error) {
    console.error('Login error:', error);
    Swal.fire({
      icon: 'error',
      title: 'Login Failed',
      text: error.message,
      confirmButtonColor: '#10B981',
    });
  }
}

// Handle registration form submission
async function handleRegisterRestaurant(event) {
  event.preventDefault();

  // Get form values using the correct IDs
  const name = document.getElementById('Name').value;
  const email = document.getElementById('Email').value;
  const phone = document.getElementById('Phone').value;
  const password = document.getElementById('Password').value;
  const confirmPassword = document.getElementById('ConfirmPassword').value;

  // Validate inputs
  if (!name || !email || !phone || !password || !confirmPassword) {
    Swal.fire({
      icon: 'warning',
      title: 'Missing Fields',
      text: 'Please fill all fields',
      confirmButtonColor: '#10B981',
    });
    return;
  }

  if (password !== confirmPassword) {
    Swal.fire({
      icon: 'error',
      title: 'Password Mismatch',
      text: 'Passwords do not match',
      confirmButtonColor: '#10B981',
    });
    return;
  }

  try {
    // Sign up the user with Supabase Auth
    const { data, error } = await window.supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          phone,
        },
      },
    });

    if (error) throw error;

    // Create user record in your authUsers table
    const userId = data.user?.id;
    if (userId) {
      const { error: userDataError } = await window.supabaseClient
        .from('authUsers')
        .insert([
          {
            authId: userId,
            name,
            phone,
            email,
          },
        ]);

      if (userDataError) throw userDataError;
    }

    // Show success message
    Swal.fire({
      icon: 'success',
      title: 'Registration Successful!',
      text: 'You can now log in to your account',
      confirmButtonColor: '#10B981',
    });

    closeModal('registerModal');

    // Update current user state
    currentUser = {
      id: data.user.id,
      email: data.user.email,
      name: name,
      phone: phone,
    };
    updateUIForLoggedInUser();
  } catch (error) {
    console.error('Registration error:', error);
    Swal.fire({
      icon: 'error',
      title: 'Registration Failed',
      text: error.message,
      confirmButtonColor: '#10B981',
    });
  }
}

// Function to show auth loading state
function showAuthLoadingState() {
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const mobileLoginBtn = document.getElementById('mobileLoginBtn');
  const mobileRegisterBtn = document.getElementById('mobileRegisterBtn');

  // Hide these buttons while checking auth
  if (loginBtn) loginBtn.style.display = 'none';
  if (registerBtn) registerBtn.style.display = 'none';
  if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
  if (mobileRegisterBtn) mobileRegisterBtn.style.display = 'none';

  // Create and show loading indicator
  const authContainer = document.querySelector('.auth-container');
  if (authContainer) {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'authLoadingIndicator';
    loadingIndicator.className = 'flex items-center';
    loadingIndicator.innerHTML = `
      <div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-green-600 mr-2"></div>
      <span class="text-gray-600">Loading...</span>
    `;
    authContainer.appendChild(loadingIndicator);
  }

  // Also handle mobile menu if it exists
  const mobileAuthContainer = document.querySelector('.mobile-auth-container');
  if (mobileAuthContainer) {
    const mobileLoadingIndicator = document.createElement('div');
    mobileLoadingIndicator.id = 'mobileAuthLoadingIndicator';
    mobileLoadingIndicator.className = 'flex items-center px-3 py-2';
    mobileLoadingIndicator.innerHTML = `
      <div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-green-600 mr-2"></div>
      <span class="text-gray-600">Loading...</span>
    `;
    mobileAuthContainer.appendChild(mobileLoadingIndicator);
  }
}

// Function to remove auth loading state
function removeAuthLoadingState() {
  const loadingIndicator = document.getElementById('authLoadingIndicator');
  if (loadingIndicator) {
    loadingIndicator.remove();
  }

  const mobileLoadingIndicator = document.getElementById(
    'mobileAuthLoadingIndicator'
  );
  if (mobileLoadingIndicator) {
    mobileLoadingIndicator.remove();
  }

  // Show the buttons again after auth check completes
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const mobileLoginBtn = document.getElementById('mobileLoginBtn');
  const mobileRegisterBtn = document.getElementById('mobileRegisterBtn');

  if (loginBtn) loginBtn.style.display = currentUser ? 'block' : 'block';
  if (registerBtn) registerBtn.style.display = currentUser ? 'none' : 'block';
  if (mobileLoginBtn) mobileLoginBtn.style.display = 'block';
  if (mobileRegisterBtn)
    mobileRegisterBtn.style.display = currentUser ? 'none' : 'block';
}

// Function to update UI for logged-in user
async function updateUIForLoggedInUser() {
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const mobileLoginBtn = document.getElementById('mobileLoginBtn');
  const mobileRegisterBtn = document.getElementById('mobileRegisterBtn');
  const mobileProfileContainer = document.getElementById(
    'mobileProfileContainer'
  );
  const authContainer = document.querySelector('.auth-container');

  // First remove the loading state if it's there
  removeAuthLoadingState();

  if (currentUser) {
    // Desktop profile icon
    let profileIcon = document.getElementById('profileIcon');
    if (!profileIcon) {
      profileIcon = document.createElement('a');
      profileIcon.id = 'profileIcon';
      profileIcon.href = 'profile.html';
      profileIcon.className =
        'flex items-center text-gray-700 hover:text-green-600 ml-4';
      profileIcon.innerHTML = `
        <i data-lucide="user" class="w-5 h-5"></i>
        <span class="ml-2">Profile</span>
      `;
      loginBtn.parentNode.insertBefore(profileIcon, loginBtn.nextSibling);
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }

    // Mobile profile link
    if (mobileProfileContainer) {
      mobileProfileContainer.innerHTML = `
        <a href="profile.html" class="flex items-center px-3 py-2 rounded-md text-gray-700 hover:text-green-600 hover:bg-gray-50">
          <i data-lucide="user" class="w-5 h-5"></i>
          <span class="ml-2">Profile</span>
        </a>
      `;
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }

    // Update buttons
    loginBtn.textContent = 'Logout';
    loginBtn.classList.remove('text-gray-700', 'hover:text-green-600');
    loginBtn.classList.add('text-red-600', 'hover:text-red-700');
    registerBtn.style.display = 'none';

    if (mobileLoginBtn) {
      mobileLoginBtn.textContent = 'Logout';
      mobileLoginBtn.classList.remove('text-gray-700', 'hover:text-green-600');
      mobileLoginBtn.classList.add('text-red-600', 'hover:text-red-700');
    }

    if (mobileRegisterBtn) {
      mobileRegisterBtn.style.display = 'none';
    }
  } else {
    // Remove desktop profile icon
    const profileIcon = document.getElementById('profileIcon');
    if (profileIcon) {
      profileIcon.remove();
    }

    // Clear mobile profile container
    if (mobileProfileContainer) {
      mobileProfileContainer.innerHTML = '';
    }

    // Update buttons
    loginBtn.textContent = 'Login';
    loginBtn.classList.remove('text-red-600', 'hover:text-red-700');
    loginBtn.classList.add('text-gray-700', 'hover:text-green-600');
    registerBtn.style.display = 'block';

    if (mobileLoginBtn) {
      mobileLoginBtn.textContent = 'Login';
      mobileLoginBtn.classList.remove('text-red-600', 'hover:text-red-700');
      mobileLoginBtn.classList.add('text-gray-700', 'hover:text-green-600');
    }

    if (mobileRegisterBtn) {
      mobileRegisterBtn.style.display = 'block';
    }
  }

  // Mark auth check as complete
  authCheckInProgress = false;
}

// Check authentication status on page load
async function checkAuthStatus() {
  try {
    // Set auth check in progress and show loading state
    authCheckInProgress = true;
    showAuthLoadingState();

    const {
      data: { user },
    } = await window.supabaseClient.auth.getUser();

    if (user) {
      // Fetch additional user data if needed
      const { data: userData, error } = await window.supabaseClient
        .from('authUsers')
        .select('*')
        .eq('authId', user.id)
        .single();

      currentUser = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || userData?.name || '',
        phone: user.user_metadata?.phone || userData?.phone || '',
      };
    } else {
      currentUser = null;
    }

    updateUIForLoggedInUser();
  } catch (error) {
    console.error('Error checking auth status:', error);
    currentUser = null;
    updateUIForLoggedInUser();
  }
}

// Function to create restaurant cards
function createRestaurantCard(restaurant) {
  const image =
    restaurant.Image || 'https://via.placeholder.com/400x300?text=No+Image';
  const name = restaurant.Name || 'Unnamed Restaurant';
  const description = restaurant.Description || 'No description available';
  const location = restaurant.Location || 'Location not specified';

  return `
    <div class="bg-white rounded-lg shadow-lg overflow-hidden">
      <img src="${image}" alt="${name}" class="w-full h-48 object-cover">
      <div class="p-6">
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-xl font-semibold">${name}</h3>
        </div>
        <p class="text-gray-600 mb-4">${description}</p>
        <div class="mb-4">
          <p class="text-sm text-gray-500">📍 ${location}</p>
        </div>
        <button onclick="showRestaurantDetails(${restaurant.id})" class="mt-4 w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-300">
          View Details
        </button>
      </div>
    </div>
  `;
}

// Function to show restaurant details
function showRestaurantDetails(restaurantId) {
  const restaurant = restaurants.find((r) => r.id === restaurantId);
  if (!restaurant) return;

  const modalImage =
    restaurant.Image || 'https://via.placeholder.com/800x400?text=No+Image';
  const modalName = restaurant.Name || 'Unnamed Restaurant';
  const modalDescription = restaurant.Description || 'No description available';
  const modalLocation = restaurant.Location || 'Location not specified';
  const modalContact = restaurant.Contact || 'Not specified';
  const modalHours = restaurant['Opening hours'] || 'Not specified';
  const modalRating = restaurant.rating || 5;

  const menuItems = restaurant.menu || [];
  const menuList =
    menuItems.length > 0
      ? menuItems
          .map((item) => `<li class="text-gray-600">${item}</li>`)
          .join('')
      : '<li class="text-gray-500">No menu items listed</li>';

  const modalContent = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="restaurantDetailModal">
      <div class="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div class="relative">
          <img src="${modalImage}" alt="${modalName}" class="w-full h-64 object-cover">
        </div>
        <div class="p-6">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h2 class="text-3xl font-bold mb-2">${modalName}</h2>
              <p class="text-gray-600">${modalDescription}</p>
            </div>
            <span class="text-yellow-500 text-2xl">★ ${modalRating}</span>
          </div>
          <div class="grid md:grid-cols-2 gap-6">
            <div>
              <h3 class="text-xl font-semibold mb-3">Location & Contact</h3>
              <p class="text-gray-600 mb-2">📍 ${modalLocation}</p>
              <p class="text-gray-600 mb-2">📞 ${modalContact}</p>
              <p class="text-gray-600">⏰ ${modalHours}</p>
            </div>
            <div>
              <h3 class="text-xl font-semibold mb-3">Popular Menu Items</h3>
              <ul class="space-y-2">
                ${menuList}
              </ul>
            </div>
          </div>
          <div class="p-6 border-t">
            <button onclick="closeRestaurantDetails()" class="text-gray-600 hover:text-gray-800">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalContent);
}

function closeRestaurantDetails() {
  const modal = document.getElementById('restaurantDetailModal');
  if (modal) modal.remove();
}

function showLoader() {
  const restaurantGrid = document.getElementById('restaurant-grid');
  restaurantGrid.innerHTML = `
    <div class="col-span-full flex justify-center items-center py-20">
      <div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-600"></div>
      <p class="ml-4 text-lg text-gray-600">Loading restaurants...</p>
    </div>
  `;
}

async function fetchRestaurants() {
  try {
    showLoader();
    const { data, error } = await window.supabaseClient
      .from('Restaurant')
      .select('*');

    if (error) {
      throw error;
    }

    restaurants = data || [];
    isLoading = false;
    displayRestaurants();
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    const restaurantGrid = document.getElementById('restaurant-grid');
    restaurantGrid.innerHTML = `
      <div class="col-span-full text-center py-20">
        <p class="text-red-600">Error loading restaurants. Please try again later.</p>
      </div>
    `;

    Swal.fire({
      icon: 'error',
      title: 'Failed to Load Restaurants',
      text: error.message,
      confirmButtonColor: '#10B981',
    });
  }
}

function displayRestaurants(restaurantsToDisplay = restaurants) {
  const restaurantGrid = document.getElementById('restaurant-grid');

  if (isLoading) {
    showLoader();
    return;
  }

  if (!restaurantsToDisplay || restaurantsToDisplay.length === 0) {
    restaurantGrid.innerHTML = `
      <div class="col-span-full text-center py-20">
        <p class="text-gray-600">No restaurants found.</p>
      </div>
    `;
    return;
  }

  const totalPages = Math.ceil(
    restaurantsToDisplay.length / restaurantsPerPage
  );
  const startIndex = (currentPage - 1) * restaurantsPerPage;
  const endIndex = startIndex + restaurantsPerPage;
  const paginatedRestaurants = restaurantsToDisplay.slice(startIndex, endIndex);

  restaurantGrid.innerHTML = paginatedRestaurants
    .map((restaurant) => createRestaurantCard(restaurant))
    .join('');

  renderPaginationControls(restaurantsToDisplay, totalPages);
}

function renderPaginationControls(restaurantsToDisplay, totalPages) {
  const paginationContainer = document.getElementById('pagination-container');
  if (!paginationContainer) {
    const restaurantsSection = document.querySelector(
      '#restaurants .max-w-7xl'
    );
    restaurantsSection.insertAdjacentHTML(
      'beforeend',
      `<div id="pagination-container" class="flex justify-center items-center mt-8 space-x-2"></div>`
    );
  }
  const container = document.getElementById('pagination-container');

  container.innerHTML = '';

  const prevButton = `
    <button onclick="changePage(${currentPage - 1})"
            ${currentPage === 1 ? 'disabled' : ''}
            class="px-4 py-2 rounded ${
              currentPage === 1
                ? 'bg-gray-200 text-gray-400'
                : 'bg-green-600 text-white hover:bg-green-700'
            }">
        Previous
    </button>
  `;

  let pageButtons = '';
  for (let i = 1; i <= totalPages; i++) {
    pageButtons += `
      <button onclick="changePage(${i})"
              class="${
                i === currentPage
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-green-100'
              }
              px-4 py-2 rounded mx-1">
          ${i}
      </button>
    `;
  }

  const nextButton = `
    <button onclick="changePage(${currentPage + 1})"
            ${currentPage === totalPages ? 'disabled' : ''}
            class="px-4 py-2 rounded ${
              currentPage === totalPages
                ? 'bg-gray-200 text-gray-400'
                : 'bg-green-600 text-white hover:bg-green-700'
            }">
        Next
    </button>
  `;

  container.innerHTML = `
    <div class="flex items-center space-x-2">
      ${prevButton}
      <div class="flex space-x-2">
        ${pageButtons}
      </div>
      ${nextButton}
    </div>
  `;
}

function changePage(page) {
  const searchInput = document.querySelector(
    'input[placeholder="Search restaurants..."]'
  );
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

  const restaurantsToDisplay = restaurants.filter(
    (restaurant) =>
      restaurant.Name.toLowerCase().includes(searchTerm) ||
      (restaurant.Description || '').toLowerCase().includes(searchTerm) ||
      (restaurant.Location || '').toLowerCase().includes(searchTerm)
  );

  const totalPages = Math.ceil(
    restaurantsToDisplay.length / restaurantsPerPage
  );

  if (page < 1 || page > totalPages) return;

  currentPage = page;
  displayRestaurants(restaurantsToDisplay);
}

function handleSearch(event) {
  const searchTerm = event.target.value.toLowerCase();
  currentPage = 1;
  const filteredRestaurants = restaurants.filter((restaurant) => {
    const name = restaurant.Name || '';
    const desc = restaurant.Description || '';
    const loc = restaurant.Location || '';
    return (
      name.toLowerCase().includes(searchTerm) ||
      desc.toLowerCase().includes(searchTerm) ||
      loc.toLowerCase().includes(searchTerm)
    );
  });
  displayRestaurants(filteredRestaurants);
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  // Check auth status first - this will now show a loading state
  checkAuthStatus();

  // Set up authentication buttons
  document.getElementById('loginBtn').addEventListener('click', async () => {
    if (currentUser) {
      try {
        await logoutUser();
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Logout Failed',
          text: error.message,
          confirmButtonColor: '#10B981',
        });
      }
    } else {
      showLoginModal();
    }
  });

  document
    .getElementById('registerBtn')
    .addEventListener('click', showRegisterModal);

  // Set up form submissions
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document
    .getElementById('registerForm')
    .addEventListener('submit', handleRegisterRestaurant);

  // Fetch restaurants from Supabase when page loads
  fetchRestaurants();

  // Set up search functionality
  const searchInput = document.querySelector(
    'input[placeholder="Search restaurants..."]'
  );
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }
});

// Restaurant management functions
function showEditForm(restaurantId) {
  Swal.fire({
    title: 'Edit Restaurant',
    text: `Edit form would appear here for restaurant ID: ${restaurantId}`,
    icon: 'info',
    confirmButtonColor: '#10B981',
  });
}

function showImageUploadForm(restaurantId) {
  Swal.fire({
    title: 'Upload Image',
    text: `Image upload would appear here for restaurant ID: ${restaurantId}`,
    icon: 'info',
    confirmButtonColor: '#10B981',
  });
}
