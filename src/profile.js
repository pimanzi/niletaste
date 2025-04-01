document.addEventListener('DOMContentLoaded', function () {
  lucide.createIcons();
});

let currentUser = null;

async function fetchCurrentUser() {
  try {
    if (!window.supabaseClient) {
      throw new Error('Supabase client is not initialized');
    }

    const { data: session } = await window.supabaseClient.auth.getSession();
    if (!session || !session.session) {
      window.location.href = 'index.html';
      return;
    }

    const { data: userData, error: userError } =
      await window.supabaseClient.auth.getUser();
    if (userError) throw new Error(userError.message);

    const userId = userData?.user?.id;
    if (!userId) {
      // Redirect to index.html if no user ID
      window.location.href = 'index.html';
      return;
    }

    const { data: authUsers, error: authUserError } =
      await window.supabaseClient
        .from('authUsers')
        .select('*')
        .eq('authId', userId)
        .single();

    if (authUserError) throw new Error(authUserError.message);

    const { data: restaurants, error: restaurantError } =
      await window.supabaseClient
        .from('Restaurant')
        .select('*')
        .eq('authUserId', authUsers.id);

    if (restaurantError) throw new Error(restaurantError.message);

    currentUser = {
      name: authUsers.name,
      email: authUsers.email,
      phone: authUsers.phone,
      restaurants: restaurants || [],
      authUserId: authUsers.id,
    };

    document.getElementById('restaurantOwner').textContent = currentUser.name;
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('userPhone').textContent =
      currentUser.phone || 'Not provided';
    displayUserRestaurants();
  } catch (error) {
    console.error('Error fetching user:', error.message);
    Swal.fire({
      icon: 'error',
      title: 'Error Loading Profile',
      text: error.message,
      confirmButtonColor: '#10B981',
    }).then(() => {
      window.location.href = 'index.html';
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await fetchCurrentUser();
});

function createRestaurantCard(restaurant) {
  return `
    <div class="bg-white rounded-lg shadow-lg overflow-hidden">
      <div class="relative">
        <img src="${restaurant.Image}" alt="${restaurant.Name}" class="w-full h-48 object-cover">
        <button onclick="showImageUploadForm(${restaurant.id})" class="absolute top-4 right-4 bg-white p-2 rounded-full shadow-lg">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
          </svg>
        </button>
      </div>
      <div class="p-6">
        <h3 class="text-xl font-semibold mb-2">${restaurant.Name}</h3>
        <p class="text-gray-600 mb-4">${restaurant.Description}</p>
        <div class="space-y-2">
          <p class="text-sm text-gray-500">📍 ${restaurant.Location}</p>
          <p class="text-sm text-gray-500">📞 ${restaurant.Contact}</p>
          <p class="text-sm text-gray-500">⏰ ${restaurant['Opening hours']}</p>
        </div>
        <div class="mt-4 flex space-x-2">
          <button onclick="showEditRestaurantForm(${restaurant.id})" class="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
            Edit
          </button>
          <button onclick="deleteRestaurant(${restaurant.id})" class="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
            Delete
          </button>
        </div>
      </div>
    </div>
  `;
}

function displayUserRestaurants() {
  const restaurantGrid = document.getElementById('userRestaurants');
  if (restaurantGrid) {
    restaurantGrid.innerHTML =
      currentUser?.restaurants
        ?.map((restaurant) => createRestaurantCard(restaurant))
        ?.join('') || '<p>No restaurants added yet</p>';
  }
}

function showModal(modalId) {
  document.getElementById(modalId)?.classList?.remove('hidden');
  document.getElementById(modalId)?.classList?.add('flex');
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList?.remove('flex');
  document.getElementById(modalId)?.classList?.add('hidden');
}

function showEditProfileForm() {
  const form = document.getElementById('editProfileForm');
  if (form && currentUser) {
    form.querySelector('input[name="name"]').value = currentUser.name;
    form.querySelector('input[name="email"]').value = currentUser.email;
    form.querySelector('input[name="phone"]').value = currentUser.phone;
  }
  showModal('editProfileModal');
}

function showAddRestaurantForm() {
  showModal('addRestaurantModal');
}

async function insertRestaurant(restaurantData, authUserId) {
  let imageUrl = '';

  if (restaurantData.image && typeof restaurantData.image !== 'string') {
    const imageName = `${Math.random()}-${
      restaurantData.image.name
    }`.replaceAll('/', '');

    const { error: uploadError } = await supabaseClient.storage
      .from('restaurants')
      .upload(imageName, restaurantData.image);

    if (uploadError) {
      throw new Error(`Image upload error: ${uploadError.message}`);
    }

    imageUrl = `https://spblrvdnzybwqwltkwqd.supabase.co/storage/v1/object/public/restaurants/${imageName}`;
  }

  const { data, error } = await supabaseClient
    .from('Restaurant')
    .insert([
      {
        Name: restaurantData.name,
        Description: restaurantData.description,
        Location: restaurantData.location,
        Contact: restaurantData.contact,
        'Opening hours': restaurantData.hours,
        Image:
          imageUrl ||
          'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
        authUserId: authUserId,
      },
    ])
    .select();

  if (error) {
    throw new Error(`Restaurant insert error: ${error.message}`);
  }

  return data;
}

document
  .getElementById('addRestaurantForm')
  ?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;

    try {
      if (!currentUser?.authUserId) {
        throw new Error('User not properly authenticated');
      }

      const restaurantData = {
        name: form.querySelector('input[name="name"]').value,
        description: form.querySelector('textarea[name="description"]').value,
        location: form.querySelector('input[name="location"]').value,
        contact: form.querySelector('input[name="contact"]').value,
        hours: form.querySelector('input[name="hours"]').value,
        image: form.querySelector('input[name="image"]').files[0] || null,
      };

      if (
        !restaurantData.name ||
        !restaurantData.description ||
        !restaurantData.location
      ) {
        throw new Error('Please fill in all required fields');
      }

      const newRestaurant = await insertRestaurant(
        restaurantData,
        currentUser.authUserId
      );

      if (newRestaurant && newRestaurant[0]) {
        currentUser.restaurants.push(newRestaurant[0]);
      } else {
        throw new Error('Failed to create restaurant');
      }

      closeModal('addRestaurantModal');
      displayUserRestaurants();
      form.reset();

      Swal.fire({
        position: 'top-end',
        icon: 'success',
        title: 'Restaurant Added Successfully!',
        showConfirmButton: false,
        timer: 2000,
        toast: true,
      });
    } catch (error) {
      console.error('Error adding restaurant:', error);
      Swal.fire({
        icon: 'error',
        title: 'Failed to Add Restaurant',
        text: error.message,
        confirmButtonColor: '#10B981',
      });
    }
  });

function showEditRestaurantForm(restaurantId) {
  const restaurant = currentUser.restaurants.find((r) => r.id === restaurantId);
  if (!restaurant) return;

  const formContent = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="editRestaurantModal">
      <div class="bg-white p-8 rounded-lg w-full max-w-md">
        <h2 class="text-2xl font-bold mb-6">Edit Restaurant</h2>
        <form id="editRestaurantForm" class="space-y-4">
          <div>
            <label class="block text-gray-700 mb-2">Restaurant Name</label>
            <input type="text" name="name" value="${restaurant.Name}" class="w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-green-600">
          </div>
          <div>
            <label class="block text-gray-700 mb-2">Description</label>
            <textarea name="description" class="w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-green-600" rows="3">${restaurant.Description}</textarea>
          </div>
          <div>
            <label class="block text-gray-700 mb-2">Location</label>
            <input type="text" name="location" value="${restaurant.Location}" class="w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-green-600">
          </div>
          <div>
            <label class="block text-gray-700 mb-2">Contact</label>
            <input type="tel" name="contact" value="${restaurant.Contact}" class="w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-green-600">
          </div>
          <div>
            <label class="block text-gray-700 mb-2">Opening Hours</label>
            <input type="text" name="hours" value="${restaurant['Opening hours']}" class="w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-green-600">
          </div>
          <button type="submit" class="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700">Save Changes</button>
        </form>
        <button onclick="closeEditRestaurantModal()" class="mt-4 text-gray-600 hover:text-gray-800">Cancel</button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', formContent);

  document
    .getElementById('editRestaurantForm')
    .addEventListener('submit', (e) => {
      e.preventDefault();
      handleEditRestaurant(restaurantId, e.target);
    });
}

function closeEditRestaurantModal() {
  const modal = document.getElementById('editRestaurantModal');
  if (modal) modal.remove();
}

async function handleEditRestaurant(restaurantId, form) {
  try {
    const restaurantData = {
      name: form.querySelector('input[name="name"]').value,
      description: form.querySelector('textarea[name="description"]').value,
      location: form.querySelector('input[name="location"]').value,
      contact: form.querySelector('input[name="contact"]').value,
      hours: form.querySelector('input[name="hours"]').value,
    };

    const restaurantIndex = currentUser.restaurants.findIndex(
      (r) => r.id === restaurantId
    );

    if (restaurantIndex !== -1) {
      currentUser.restaurants[restaurantIndex] = {
        ...currentUser.restaurants[restaurantIndex],
        Name: restaurantData.name,
        Description: restaurantData.description,
        Location: restaurantData.location,
        Contact: restaurantData.contact,
        'Opening hours': restaurantData.hours,
      };

      displayUserRestaurants();
    }

    const { error } = await supabaseClient
      .from('Restaurant')
      .update({
        Name: restaurantData.name,
        Description: restaurantData.description,
        Location: restaurantData.location,
        Contact: restaurantData.contact,
        'Opening hours': restaurantData.hours,
      })
      .eq('id', restaurantId);

    if (error) {
      throw error;
    }

    closeEditRestaurantModal();

    Swal.fire({
      position: 'top-end',
      icon: 'success',
      title: 'Restaurant Updated!',
      showConfirmButton: false,
      timer: 2000,
      toast: true,
    });
  } catch (error) {
    console.error('Error updating restaurant:', error);

    if (restaurantIndex !== -1) {
      fetchCurrentUser();
    }

    Swal.fire({
      icon: 'error',
      title: 'Update Failed',
      text: error.message,
      confirmButtonColor: '#10B981',
    });
  }
}

async function deleteRestaurant(id) {
  const result = await Swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#10B981',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, delete it!',
  });

  if (!result.isConfirmed) return;

  try {
    const { error } = await window.supabaseClient
      .from('Restaurant')
      .delete()
      .eq('id', id);

    if (error) throw error;

    currentUser.restaurants = currentUser.restaurants.filter(
      (r) => r.id !== id
    );
    displayUserRestaurants();

    Swal.fire({
      position: 'top-end',
      icon: 'success',
      title: 'Restaurant Deleted!',
      showConfirmButton: false,
      timer: 2000,
      toast: true,
    });
  } catch (error) {
    console.error('Error deleting restaurant:', error);
    Swal.fire({
      icon: 'error',
      title: 'Delete Failed',
      text: error.message,
      confirmButtonColor: '#10B981',
    });
  }
}

function showImageUploadForm(restaurantId) {
  const formContent = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="imageUploadModal">
      <div class="bg-white p-8 rounded-lg w-full max-w-md">
        <h2 class="text-2xl font-bold mb-6">Upload Restaurant Image</h2>
        <form id="imageUploadForm" class="space-y-4">
          <div>
            <label class="block text-gray-700 mb-2">Select Image</label>
            <input type="file" name="image" accept="image/*" class="w-full" required>
          </div>
          <button type="submit" class="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700">Upload</button>
        </form>
        <button onclick="closeImageUploadModal()" class="mt-4 text-gray-600 hover:text-gray-800">Cancel</button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', formContent);

  document
    .getElementById('imageUploadForm')
    .addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleImageUpload(restaurantId, e.target);
    });
}

function closeImageUploadModal() {
  const modal = document.getElementById('imageUploadModal');
  if (modal) modal.remove();
}

async function handleImageUpload(restaurantId, form) {
  try {
    const imageFile = form.querySelector('input[name="image"]').files[0];
    if (!imageFile) throw new Error('No image selected');

    const imageName = `${Math.random()}-${imageFile.name}`.replaceAll('/', '');

    const { error: uploadError } = await supabaseClient.storage
      .from('restaurants')
      .upload(imageName, imageFile);

    if (uploadError) throw uploadError;

    const imageUrl = `https://spblrvdnzybwqwltkwqd.supabase.co/storage/v1/object/public/restaurants/${imageName}`;

    const { error: updateError } = await supabaseClient
      .from('Restaurant')
      .update({ Image: imageUrl })
      .eq('id', restaurantId);

    if (updateError) throw updateError;

    const restaurant = currentUser.restaurants.find(
      (r) => r.id === restaurantId
    );
    if (restaurant) {
      restaurant.Image = imageUrl;
    }

    closeImageUploadModal();
    displayUserRestaurants();

    Swal.fire({
      position: 'top-end',
      icon: 'success',
      title: 'Image Uploaded!',
      showConfirmButton: false,
      timer: 2000,
      toast: true,
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    Swal.fire({
      icon: 'error',
      title: 'Upload Failed',
      text: error.message,
      confirmButtonColor: '#10B981',
    });
  }
}

document
  .getElementById('editProfileForm')
  ?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;

    try {
      const { error } = await supabaseClient
        .from('authUsers')
        .update({
          name: form.querySelector('input[name="name"]').value,
          email: form.querySelector('input[name="email"]').value,
          phone: form.querySelector('input[name="phone"]').value,
        })
        .eq('id', currentUser.authUserId);

      if (error) throw error;

      currentUser.name = form.querySelector('input[name="name"]').value;
      currentUser.email = form.querySelector('input[name="email"]').value;
      currentUser.phone = form.querySelector('input[name="phone"]').value;

      document.getElementById('restaurantOwner').textContent = currentUser.name;
      document.getElementById('userEmail').textContent = currentUser.email;
      document.getElementById('userPhone').textContent =
        currentUser.phone || 'Not provided';

      closeModal('editProfileModal');

      Swal.fire({
        position: 'top-end',
        icon: 'success',
        title: 'Profile Updated!',
        showConfirmButton: false,
        timer: 2000,
        toast: true,
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: error.message,
        confirmButtonColor: '#10B981',
      });
    }
  });

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;

    Swal.fire({
      position: 'top-end',
      icon: 'success',
      title: 'Logged Out!',
      showConfirmButton: false,
      timer: 1500,
      toast: true,
    }).then(() => {
      window.location.href = 'index.html';
    });
  } catch (error) {
    console.error('Error logging out:', error);
    Swal.fire({
      icon: 'error',
      title: 'Logout Failed',
      text: error.message,
      confirmButtonColor: '#10B981',
    });
  }
});
