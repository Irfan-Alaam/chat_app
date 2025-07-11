document.addEventListener('DOMContentLoaded', () => {
    async function showAdminPanel() {
    try {
      // Verify admin status first
      const user = await loadUserInfo();
      if (user.role !== 'admin') {
        window.location.href = '/';
        return;
      }

      // Load admin data
      await loadAllUsers();
      await loadAllRooms();
      
    } catch (error) {
      console.error('Admin panel error:', error);
    }
  }

  // Call this when admin panel button is clicked
  document.getElementById('admin-panel-btn')?.addEventListener('click', showAdminPanel);
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    let currentRoom = null;
    let currentRoomToken = null;
    let socket = null;
    let username = '';
    let userId = null;
    let userRole = null;

    // DOM elements
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logout-btn');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const roomsList = document.getElementById('rooms-list');
    const usersList = document.getElementById('users-list');
    const chatMessages = document.getElementById('chat-messages');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const currentRoomName = document.getElementById('current-room-name');
    const createRoomModal = document.getElementById('create-room-modal');
    const joinRoomModal = document.getElementById('join-room-modal');
    const createRoomForm = document.getElementById('create-room-form');
    const joinRoomForm = document.getElementById('join-room-form');
    const roomPrivateCheckbox = document.getElementById('room-private');
    const tokenModal = document.getElementById('token-modal');
    const roomTokenDisplay = document.getElementById('room-token-display');
    const copyTokenBtn = document.getElementById('copy-token-btn');
    const copyStatus = document.getElementById('copy-status');
    const closeTokenModal = document.getElementById('close-token-modal');
    const updateRoomModal = document.getElementById('update-room-modal');
    const updateRoomForm = document.getElementById('update-room-form');
    const showTokenBtn = document.getElementById('show-token-btn');
    const tokenDisplay = document.getElementById('token-display');

    // Modal controls
    const modalCloseBtns = document.querySelectorAll('.close-modal');
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            createRoomModal.classList.remove('active');
            joinRoomModal.classList.remove('active');
            tokenModal.classList.remove('active');
            updateRoomModal.classList.remove('active');
            document.getElementById('admin-modal')?.classList.remove('active');
        });
    });

    closeTokenModal.addEventListener('click', () => {
        tokenModal.classList.remove('active');
    });

    copyTokenBtn.addEventListener('click', () => {
        roomTokenDisplay.select();
        document.execCommand('copy');
        copyStatus.textContent = 'Copied to clipboard!';
        setTimeout(() => {
            copyStatus.textContent = '';
        }, 2000);
    });

    // Load user info
    async function loadUserInfo() {
        try {
            const response = await fetch('/users/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const user = await response.json();
                username = user.username;
                userId = user.id;
                userRole = user.role;
                usernameDisplay.textContent = username;
            } else {
                throw new Error('Failed to load user info');
            }
        } catch (error) {
            console.error('Error loading user info:', error);
            logout();
        }
    }

    // Add admin controls to the UI
   function addAdminControls() {
  if (userRole === 'admin') {
    const adminBtn = document.createElement('button');
    adminBtn.id = 'admin-panel-btn';
    adminBtn.className = 'btn admin-btn';
    adminBtn.textContent = 'Admin Panel';
    document.querySelector('.user-info').prepend(adminBtn);
    
    adminBtn.addEventListener('click', async () => {
      document.getElementById('admin-modal').classList.add('active');
      try {
        await loadAllUsers();
        await loadAllRooms();
      } catch (error) {
        console.error('Error loading admin data:', error);
      }
    });
  }
}

    // Load all rooms (admin only)
   async function loadAllRooms() {
  try {
    const adminRoomsList = document.getElementById('admin-rooms-list').querySelector('tbody');
    adminRoomsList.innerHTML = '<tr><td colspan="4" class="loading">Loading rooms...</td></tr>';
    
    const response = await fetch('/admin/rooms', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    // First check if response is ok
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error:', response.status, errorData);
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    const rooms = await response.json();
    console.log('Rooms data:', rooms); // Debug log
    
    // Clear loading message
    adminRoomsList.innerHTML = '';
    
    if (rooms.length === 0) {
      adminRoomsList.innerHTML = '<tr><td colspan="4" class="no-rooms">No rooms found</td></tr>';
      return;
    }
    
    rooms.forEach(room => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${room.id}</td>
        <td>${room.name}</td>
        <td>${room.created_by}</td>
        <td>
          <button class="btn delete-room-btn" data-roomid="${room.id}">Delete</button>
        </td>
      `;
      adminRoomsList.appendChild(row);
    });
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-room-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const roomId = e.target.dataset.roomid;
        if (confirm(`Delete room ${roomId}?`)) {
          await deleteRoomAdmin(roomId);
        }
      });
    });
    
  } catch (error) {
    console.error('Error loading rooms:', error);
    const adminRoomsList = document.getElementById('admin-rooms-list')?.querySelector('tbody');
    if (adminRoomsList) {
      adminRoomsList.innerHTML = `
        <tr class="error">
          <td colspan="4">
            Error: ${error.message}
            <button class="retry-btn">Retry</button>
          </td>
        </tr>
      `;
      adminRoomsList.querySelector('.retry-btn').addEventListener('click', loadAllRooms);
    }
  }
}

async function deleteRoomAdmin(roomId) {
  try {
    const response = await fetch(`/admin/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete room');
    }
    
    await loadAllRooms(); // Refresh the list
    addSystemMessage('Room deleted successfully');
    
  } catch (error) {
    console.error('Error deleting room:', error);
    addSystemMessage(`Failed to delete room: ${error.message}`);
  }
}

    // Load all users (admin only)
    async function loadAllUsers() {
    try {
        // Show loading state
        const adminUsersList = document.getElementById('admin-users-list');
        adminUsersList.innerHTML = '<tr><td colspan="5" class="loading">Loading users...</td></tr>';
        
        const response = await fetch('/admin/users', {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Failed to load users');
        }
        
        const users = await response.json();
        adminUsersList.innerHTML = '';
        
        if (users.length === 0) {
            adminUsersList.innerHTML = '<tr><td colspan="5" class="no-users">No users found</td></tr>';
            return;
        }
        
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email || 'N/A'}</td>
                <td>${user.role}</td>
                <td>
                    <button class="btn delete-user-btn" data-userid="${user.id}">Delete</button>
                </td>
            `;
            adminUsersList.appendChild(row);
        });
        
        // Add delete handlers
        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const userId = e.target.dataset.userid;
                if (confirm(`Are you sure you want to delete user ${userId}?`)) {
                    await deleteUser(userId);
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading users:', error);
        const adminUsersList = document.getElementById('admin-users-list');
        adminUsersList.innerHTML = `
            <tr class="error">
                <td colspan="5">
                    Failed to load users
                    <button id="retry-load-users" class="retry-btn">Retry</button>
                </td>
            </tr>
        `;
        document.getElementById('retry-load-users')?.addEventListener('click', loadAllUsers);
    }
}

// Delete user function
async function deleteUser(userId) {
    try {
        const response = await fetch(`/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            await loadAllUsers(); // Refresh the list
            addSystemMessage('User deleted successfully');
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        addSystemMessage(`Failed to delete user: ${error.message}`);
    }
}

    // Load rooms for current user
    async function loadUserRooms() {
        try {
            roomsList.innerHTML = '<li class="loading">Loading rooms...</li>';
            
            const response = await fetch('/users/me/rooms', {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to load rooms');
            }
            
            const rooms = await response.json();
            roomsList.innerHTML = '';
            
            if (rooms.length === 0) {
                roomsList.innerHTML = '<li class="no-rooms">No rooms yet. Create or join one!</li>';
                return;
            }
            
            rooms.forEach(room => {
                addRoomToList(
                    room.name, 
                    room.token, 
                    String(room.created_by) === String(userId),
                    room.is_private
                );
            });
            
            // Re-highlight current room if one is selected
            if (currentRoomToken) {
                highlightSelectedRoom(currentRoomToken);
            }
            
        } catch (error) {
            console.error('Error loading rooms:', error);
            roomsList.innerHTML = `
                <li class="error">
                    Failed to load rooms
                    <button id="retry-load-rooms" class="retry-btn">Retry</button>
                </li>
            `;
            document.getElementById('retry-load-rooms')?.addEventListener('click', loadUserRooms);
        }
    }

    // Add room to sidebar list with edit/delete options
    function addRoomToList(name, token, isOwner, isPrivate = false) {
        const roomItem = document.createElement('li');
        roomItem.dataset.token = token;
        
        // Highlight if this is the current room
        if (currentRoomToken === token) {
            roomItem.classList.add('selected');
        }
        
        const showControls = isOwner || userRole === 'admin';
        
        roomItem.innerHTML = `
            <span class="room-name">${name}</span>
            <div class="room-actions">
                ${isPrivate ? '<button class="lock-icon" title="Show room token">🔒</button>' : ''}
                ${showControls ? '<button class="edit-room-icon" title="Edit room">✏️</button>' : ''}
                ${showControls ? '<button class="delete-room-icon" title="Delete room">🗑️</button>' : ''}
                ${userRole === 'admin' ? '<button class="admin-delete-icon" title="Force delete">🛑</button>' : ''}
            </div>
        `;

        // Room click handler
        roomItem.addEventListener('click', (e) => {
            if (!e.target.classList.contains('room-actions') && 
                !e.target.closest('.room-actions')) {
                joinRoomByToken(token);
            }
        });

        // Add lock icon handler if private room
        if (isPrivate) {
            const lockBtn = roomItem.querySelector('.lock-icon');
            lockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showRoomToken(token);
            });
        }

        // Add edit handler if owner or admin
        if (showControls) {
            const editBtn = roomItem.querySelector('.edit-room-icon');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showUpdateRoomModal(token, name);
            });
            
            const deleteBtn = roomItem.querySelector('.delete-room-icon');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteRoom(token);
            });
        }
        
        // Add admin delete handler
        if (userRole === 'admin') {
            const adminDeleteBtn = roomItem.querySelector('.admin-delete-icon');
            adminDeleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                adminDeleteRoom(token);
            });
        }
        
        roomsList.appendChild(roomItem);
    }

    // Show room token
    function showRoomToken(roomToken) {
        roomTokenDisplay.value = roomToken;
        tokenModal.classList.add('active');
    }

    // Highlight selected room
    function highlightSelectedRoom(roomToken) {
        // Remove highlight from all rooms
        document.querySelectorAll('#rooms-list li').forEach(room => {
            room.classList.remove('selected');
        });
        
        // Add highlight to the selected room
        const selectedRoom = document.querySelector(`#rooms-list li[data-token="${roomToken}"]`);
        if (selectedRoom) {
            selectedRoom.classList.add('selected');
            selectedRoom.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // Admin delete function
    async function adminDeleteRoom(roomToken) {
        if (!confirm('ADMIN: Are you sure you want to force delete this room?')) {
            return;
        }
        
        try {
            // First get room ID
            const roomInfo = await fetch(`/rooms/token/${roomToken}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.json());
            
            // Then delete as admin
            const response = await fetch(`/admin/rooms/${roomInfo.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                await loadUserRooms();
                addSystemMessage('Room deleted by admin');
                
                // If we're in the deleted room, reset UI
                if (currentRoomToken === roomToken) {
                    resetRoomUI();
                }
            }
        } catch (error) {
            console.error('Admin delete error:', error);
            addSystemMessage('Admin delete failed');
        }
    }

    // Show update room modal
    function showUpdateRoomModal(roomToken, currentName) {
        document.getElementById('update-room-name').value = currentName;
        document.getElementById('update-room-token').value = roomToken;
        updateRoomModal.classList.add('active');
    }

    // Update room function
    async function updateRoom() {
        const roomToken = document.getElementById('update-room-token').value;
        const newName = document.getElementById('update-room-name').value.trim();
        
        if (!newName) {
            alert('Room name cannot be empty');
            return;
        }
        
        try {
            const response = await fetch(`/rooms/${roomToken}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newName })
            });
            
            if (response.ok) {
                updateRoomModal.classList.remove('active');
                await loadUserRooms();
                
                // Update current room if we're in it
                if (currentRoomToken === roomToken) {
                    currentRoom = newName;
                    currentRoomName.textContent = newName;
                }
            } else {
                const error = await response.json();
                alert(error.detail || 'Failed to update room');
            }
        } catch (error) {
            console.error('Error updating room:', error);
            alert('Failed to update room');
        }
    }

    // Delete room function
    async function deleteRoom(roomToken) {
        if (!confirm('Are you sure you want to delete this room? All messages will be lost.')) {
            return;
        }
        
        try {
            const response = await fetch(`/rooms/${roomToken}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                if (currentRoomToken === roomToken) {
                    resetRoomUI();
                    addSystemMessage('Room deleted');
                }
                await loadUserRooms();
            } else {
                throw new Error('Failed to delete room');
            }
        } catch (error) {
            console.error('Error deleting room:', error);
            addSystemMessage('Failed to delete room');
        }
    }

    // Reset room UI
    function resetRoomUI() {
        if (socket) {
            socket.close();
            socket = null;
        }
        
        currentRoom = null;
        currentRoomToken = null;
        currentRoomName.textContent = 'Select a room';
        messageInput.disabled = true;
        messageForm.querySelector('button').disabled = true;
        chatMessages.innerHTML = '<p class="system-message">Select a room to start chatting</p>';
        usersList.innerHTML = '';
    }

    // Join room by token
    async function joinRoomByToken(roomToken) {
        if (!roomToken || currentRoomToken === roomToken) return;
        
        if (socket) {
            socket.close();
        }
        
        try {
            const response = await fetch(`/rooms/token/${roomToken}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to get room info');
            }
            
            const roomInfo = await response.json();
            currentRoom = roomInfo.name;
            currentRoomToken = roomToken;
            currentRoomName.textContent = currentRoom;
            
            highlightSelectedRoom(roomToken);
            
            socket = new WebSocket(`ws://${window.location.host}/ws/token/${roomToken}?token=${token}`);
            
            socket.onopen = () => {
                messageInput.disabled = false;
                messageForm.querySelector('button').disabled = false;
                chatMessages.innerHTML = '';
                addSystemMessage(`Joined ${currentRoom}`);
            };
            
            socket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                if (message.type === 'system') {
                    addSystemMessage(message.content);
                } else if (message.type === 'history') {
                    addMessage(message, false);
                } else if (message.type === 'chat') {
                    addMessage(message, message.sender === username);
                }
            };
            
            socket.onclose = () => {
                addSystemMessage(`Disconnected from ${currentRoom}`);
                resetRoomUI();
            };
            
            socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                addSystemMessage('Connection error');
            };
            
        } catch (error) {
            console.error('Error joining room:', error);
            addSystemMessage(`Failed to join room: ${error.message}`);
        }
    }


    // Add message to chat
    function addMessage(message, isSelf) {
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${isSelf ? 'self' : ''}`;
        messageEl.innerHTML = `
            <div class="sender">${message.sender}</div>
            <div class="content">${message.content}</div>
            <div class="timestamp">${new Date(message.timestamp).toLocaleTimeString()}</div>
        `;
        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Add system message
    function addSystemMessage(text) {
        const messageEl = document.createElement('p');
        messageEl.className = 'system-message';
        messageEl.textContent = text;
        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Event listeners
    createRoomBtn.addEventListener('click', () => {
        createRoomModal.classList.add('active');
    });

    createRoomForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('room-name').value.trim();
        const description = document.getElementById('room-description').value.trim();
        const isPrivate = document.getElementById('room-private').checked;
        
        if (!name) {
            alert('Room name cannot be empty');
            return;
        }

        try {
            const response = await fetch('/rooms/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, description, is_private: isPrivate })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || 'Failed to create room');
            }

            createRoomModal.classList.remove('active');
            
            // Show token modal if room is private
            if (isPrivate) {
                roomTokenDisplay.value = data.room_token;
                tokenModal.classList.add('active');
            }
            
            // Add the new room to the list
            addRoomToList(name, data.room_token, true, isPrivate);
            
            // Join the new room
            await joinRoomByToken(data.room_token);
            
            createRoomForm.reset();
            
        } catch (error) {
            console.error('Error creating room:', error);
            alert(error.message || 'Failed to create room');
        }
    });

    joinRoomBtn.addEventListener('click', () => {
        joinRoomModal.classList.add('active');
    });

    joinRoomForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const roomToken = document.getElementById('join-room-token').value;
        if (!roomToken) return;
        joinRoomModal.classList.remove('active');
        joinRoomByToken(roomToken);
        joinRoomForm.reset();
    });

    showTokenBtn.addEventListener('click', () => {
        if (currentRoomToken) {
            tokenDisplay.textContent = currentRoomToken;
            tokenDisplay.classList.toggle('hidden');
            
            // Auto-hide after 5 seconds
            if (!tokenDisplay.classList.contains('hidden')) {
                setTimeout(() => {
                    tokenDisplay.classList.add('hidden');
                }, 5000);
            }
        }
    });

    updateRoomForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await updateRoom();
    });

     messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const message = messageInput.value.trim();
        if (message && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(message);
            messageInput.value = '';
        }
    });


    logoutBtn.addEventListener('click', logout);
    
    function logout() {
        localStorage.removeItem('token');
        if (socket) socket.close();
        window.location.href = '/';
    }

    // Initialize
    async function init() {
        await loadUserInfo();
        addAdminControls();
        await loadUserRooms();
    }
    
    init();
});