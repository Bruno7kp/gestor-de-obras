#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:4000"
INSTANCE="Abc"

echo "======================================"
echo "Testing Backend Permission System"
echo "======================================"

# Test 1: Login as Gestor Principal (should have all permissions)
echo -e "\n${YELLOW}[TEST 1]${NC} Login as Gestor Principal admin@exemplo.com"
RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "adm@exemplo.com",
    "password": "12345678",
    "instanceId": "'$INSTANCE'"
  }')

TOKEN=$(echo $RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
PERMISSIONS=$(echo $RESPONSE | grep -o '"permissions":\[[^]]*\]')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ Login failed${NC}"
  echo "Response: $RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo "Token: ${TOKEN:0:20}..."
echo "Permissions: $PERMISSIONS"

# Test 2: Try to create a project with valid permission
echo -e "\n${YELLOW}[TEST 2]${NC} Create project (should succeed with projects.edit permission)"
CREATE_PROJECT=$(curl -s -X POST "$API_URL/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Projeto Teste",
    "companyName": "Empresa Teste",
    "location": "São Paulo"
  }')

if echo $CREATE_PROJECT | grep -q '"id"'; then
  echo -e "${GREEN}✓ Project created successfully${NC}"
  PROJECT_ID=$(echo $CREATE_PROJECT | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1)
  echo "Project ID: $PROJECT_ID"
else
  echo -e "${RED}✗ Project creation failed${NC}"
  echo "Response: $CREATE_PROJECT"
fi

# Test 3: Try to create a work item
echo -e "\n${YELLOW}[TEST 3]${NC} Create work item (should succeed with wbs.edit permission)"
if [ ! -z "$PROJECT_ID" ]; then
  CREATE_ITEM=$(curl -s -X POST "$API_URL/work-items" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "projectId": "'$PROJECT_ID'",
      "name": "Item Teste",
      "type": "category",
      "wbs": "1"
    }')
  
  if echo $CREATE_ITEM | grep -q '"id"'; then
    echo -e "${GREEN}✓ Work item created successfully${NC}"
  else
    echo -e "${RED}✗ Work item creation failed${NC}"
    echo "Response: $CREATE_ITEM"
  fi
fi

# Test 4: Create a second user with limited permissions and test
echo -e "\n${YELLOW}[TEST 4]${NC} Testing with user that has only view permissions (if created)"
echo "Note: Limited user testing requires creating a user with restricted permissions"
echo "Run this manually in the UI or database"

echo -e "\n${YELLOW}[TEST 5]${NC} Verify permission codes in login response"
if echo "$PERMISSIONS" | grep -q "projects.edit\|biddings.edit\|suppliers.edit"; then
  echo -e "${GREEN}✓ Permission codes present in response${NC}"
  echo "Sample permissions: $PERMISSIONS"
else
  echo -e "${RED}✗ No permission codes in response${NC}"
  echo "Permissions: $PERMISSIONS"
fi

echo -e "\n======================================"
echo "Backend Permission Tests Complete"
echo "======================================"
