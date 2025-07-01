// src/pages/UserManagement.js - 백엔드 구조에 맞게 수정된 사용자 관리 페이지
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Switch,
  FormControlLabel,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import api from '../services/api';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');

  // 다이얼로그 상태
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // 스낵바 상태
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // ✅ 백엔드 필드명에 맞게 수정: active 필드 사용
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    role: 'viewer', // ✅ 백엔드 기본값에 맞게 수정
    active: true,   // ✅ isActive → active로 변경
    password: '',
    confirmPassword: '',
  });

  const [formErrors, setFormErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    fetchUsers();
  }, []);

  // ✅ 사용자 목록 조회 - 백엔드 응답 구조에 맞게 수정
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.users.getAll();

      console.log('API 응답:', response.data); // 디버깅용

      if (response.data && response.data.success) {
        // ✅ 백엔드 응답 구조: { success: true, users: [...] }
        const usersData = (response.data.users || []).map(user => ({
          ...user,
          // ✅ 백엔드에서 active 필드를 사용하므로 그대로 사용
          active: Boolean(user.active),
          // ✅ 백엔드에서 profile 객체 사용
          fullName: user.profile?.firstName && user.profile?.lastName
            ? `${user.profile.firstName} ${user.profile.lastName}`
            : user.username
        }));

        setUsers(usersData);
        console.log('사용자 목록 로드됨:', usersData);
      }
    } catch (error) {
      console.error('사용자 목록 조회 실패:', error);
      setSnackbar({
        open: true,
        message: '사용자 목록을 불러오는데 실패했습니다.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // 검색 필터 적용
  useEffect(() => {
    if (!searchTerm) {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user =>
        (user.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.fullName || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
    setPage(0);
  }, [users, searchTerm]);

  // ✅ 다이얼로그 열기 - 백엔드 필드명에 맞게 수정
  const handleOpenDialog = (user = null) => {
    setEditingUser(user);
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        fullName: user.fullName || '',
        role: user.role || 'viewer',
        active: Boolean(user.active), // ✅ active 필드 사용
        password: '',
        confirmPassword: '',
      });
    } else {
      setFormData({
        username: '',
        email: '',
        fullName: '',
        role: 'viewer', // ✅ 백엔드 기본값
        active: true,   // ✅ active 필드 사용
        password: '',
        confirmPassword: '',
      });
    }
    setFormErrors({});
    setDialogOpen(true);
  };

  // ✅ 다이얼로그 닫기 - 백엔드 필드명에 맞게 수정
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      fullName: '',
      role: 'viewer',
      active: true, // ✅ active 필드 사용
      password: '',
      confirmPassword: '',
    });
    setFormErrors({});
  };

  // ✅ 폼 입력 변경 - active 필드 처리
  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'active' ? Boolean(value) : value, // ✅ active 필드 처리
    }));

    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  // 폼 유효성 검사
  const validateForm = () => {
    const errors = {};
    const safeString = (value) => (value || '').toString();

    if (!safeString(formData.username).trim()) {
      errors.username = '사용자명을 입력해주세요.';
    }

    if (!safeString(formData.email).trim()) {
      errors.email = '이메일을 입력해주세요.';
    } else if (!/\S+@\S+\.\S+/.test(safeString(formData.email))) {
      errors.email = '유효한 이메일 주소를 입력해주세요.';
    }

    if (!safeString(formData.fullName).trim()) {
      errors.fullName = '이름을 입력해주세요.';
    }

    if (!editingUser) {
      if (!safeString(formData.password)) {
        errors.password = '비밀번호를 입력해주세요.';
      } else if (safeString(formData.password).length < 6) {
        errors.password = '비밀번호는 최소 6자 이상이어야 합니다.';
      }

      if (safeString(formData.password) !== safeString(formData.confirmPassword)) {
        errors.confirmPassword = '비밀번호가 일치하지 않습니다.';
      }
    } else if (safeString(formData.password) && safeString(formData.password) !== safeString(formData.confirmPassword)) {
      errors.confirmPassword = '비밀번호가 일치하지 않습니다.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ✅ 로컬 상태 즉시 업데이트 함수 - active 필드 사용
  const updateUserInState = (updatedUser) => {
    setUsers(prevUsers =>
      prevUsers.map(user =>
        user.id === updatedUser.id
          ? { ...user, ...updatedUser, active: Boolean(updatedUser.active) }
          : user
      )
    );
  };

  // ✅ 사용자 저장 - 백엔드 필드명과 요청 구조에 맞게 수정
  const handleSaveUser = async () => {
    if (!validateForm()) return;

    try {
      setSubmitLoading(true);

      // ✅ 백엔드에 맞는 payload 구조
      const payload = {
        username: (formData.username || '').toString().trim(),
        email: (formData.email || '').toString().trim(),
        role: formData.role || 'viewer',
        active: Boolean(formData.active), // ✅ active 필드 사용
        // ✅ 백엔드에서 profile 객체 사용
        profile: {
          firstName: (formData.fullName || '').toString().trim(),
          lastName: '', // 간단하게 firstName만 사용
        }
      };

      // 비밀번호 처리
      const password = (formData.password || '').toString();
      if (!editingUser || password) {
        payload.password = password;
      }

      console.log('저장할 데이터:', payload); // 디버깅용

      let response;
      if (editingUser) {
        response = await api.users.update(editingUser.id, payload);

        // ✅ 업데이트 성공 시 로컬 상태 즉시 업데이트
        if (response.data && response.data.success) {
          const updatedUser = {
            ...editingUser,
            ...payload,
            fullName: payload.profile.firstName,
            id: editingUser.id
          };
          updateUserInState(updatedUser);
        }
      } else {
        response = await api.users.create(payload);
      }

      if (response.data && response.data.success) {
        handleCloseDialog();

        // ✅ 새 사용자 생성 시에만 전체 목록 다시 로드
        if (!editingUser) {
          await fetchUsers();
        }

        setSnackbar({
          open: true,
          message: response.data.message || (editingUser ? '사용자 정보가 업데이트되었습니다.' : '새 사용자가 추가되었습니다.'),
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('사용자 저장 실패:', error);
      const errorMessage = error.response?.data?.message || '저장 중 오류가 발생했습니다.';

      setFormErrors({
        submit: errorMessage
      });

      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  // 삭제 확인 다이얼로그 열기
  const handleOpenDeleteDialog = (user) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  // 삭제 확인 다이얼로그 닫기
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  // 사용자 삭제
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const response = await api.users.delete(userToDelete.id);

      if (response.data && response.data.success) {
        // ✅ 삭제 성공 시 로컬 상태에서 즉시 제거
        setUsers(prevUsers => prevUsers.filter(user => user.id !== userToDelete.id));

        handleCloseDeleteDialog();

        setSnackbar({
          open: true,
          message: response.data.message || '사용자가 삭제되었습니다.',
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('사용자 삭제 실패:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || '사용자 삭제 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  // ✅ 빠른 상태 토글 기능 - active 필드 사용
  const handleQuickToggleStatus = async (user) => {
    try {
      const newStatus = !user.active;

      // ✅ 즉시 UI 업데이트
      updateUserInState({ ...user, active: newStatus });

      // 백엔드 업데이트
      const response = await api.users.update(user.id, {
        active: newStatus
      });

      if (response.data && response.data.success) {
        setSnackbar({
          open: true,
          message: `${user.fullName}님의 상태가 ${newStatus ? '활성' : '비활성'}으로 변경되었습니다.`,
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('상태 변경 실패:', error);

      // ✅ 실패 시 원래 상태로 되돌리기
      await fetchUsers();

      setSnackbar({
        open: true,
        message: error.response?.data?.message || '상태 변경 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  // 페이지 변경
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // 페이지당 행 수 변경
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // 스낵바 닫기
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // ✅ 역할별 색상 - 백엔드 역할에 맞게 수정
  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'operator':
        return 'warning';
      case 'viewer':
        return 'primary';
      case 'emergency':
        return 'secondary';
      default:
        return 'default';
    }
  };

  // ✅ 역할별 텍스트 - 백엔드 역할에 맞게 수정
  const getRoleText = (role) => {
    switch (role) {
      case 'admin':
        return '관리자';
      case 'operator':
        return '운영자';
      case 'viewer':
        return '관람자';
      case 'emergency':
        return '긴급상황';
      default:
        return '알 수 없음';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">사용자 관리</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          새 사용자 추가
        </Button>
      </Box>

      {loading && (
        <Alert severity="info" sx={{ mb: 3 }}>
          사용자 목록을 불러오는 중입니다...
        </Alert>
      )}

      {/* 검색 및 필터 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="검색"
              placeholder="사용자명, 이메일, 이름 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.disabled' }} />,
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Tooltip title="새로고침">
                <IconButton onClick={fetchUsers}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* 사용자 테이블 */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>사용자명</TableCell>
                <TableCell>이름</TableCell>
                <TableCell>이메일</TableCell>
                <TableCell>역할</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>등록일</TableCell>
                <TableCell>작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>{user.username || ''}</TableCell>
                    <TableCell>{user.fullName || ''}</TableCell>
                    <TableCell>{user.email || ''}</TableCell>
                    <TableCell>
                      <Chip
                        label={getRoleText(user.role)}
                        color={getRoleColor(user.role)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {/* ✅ active 필드 사용 */}
                      <Chip
                        label={Boolean(user.active) ? '활성' : '비활성'}
                        color={Boolean(user.active) ? 'success' : 'default'}
                        size="small"
                        onClick={() => handleQuickToggleStatus(user)}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': {
                            opacity: 0.8
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : '-'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="편집">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(user)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="삭제">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDeleteDialog(user)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredUsers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="페이지당 행 수:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} / 총 ${count}개`
          }
        />
      </Paper>

      {/* 사용자 추가/편집 다이얼로그 */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? '사용자 편집' : '새 사용자 추가'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {formErrors.submit && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formErrors.submit}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="사용자명"
                  value={formData.username}
                  onChange={(e) => handleFormChange('username', e.target.value)}
                  error={!!formErrors.username}
                  helperText={formErrors.username}
                  disabled={!!editingUser}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="이름"
                  value={formData.fullName}
                  onChange={(e) => handleFormChange('fullName', e.target.value)}
                  error={!!formErrors.fullName}
                  helperText={formErrors.fullName}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="이메일"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                  error={!!formErrors.email}
                  helperText={formErrors.email}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>역할</InputLabel>
                  <Select
                    value={formData.role}
                    onChange={(e) => handleFormChange('role', e.target.value)}
                    label="역할"
                  >
                    {/* ✅ 백엔드 역할에 맞게 수정 */}
                    <MenuItem value="viewer">관람자</MenuItem>
                    <MenuItem value="operator">운영자</MenuItem>
                    <MenuItem value="admin">관리자</MenuItem>
                    <MenuItem value="emergency">긴급상황</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(formData.active)} // ✅ active 필드 사용
                      onChange={(e) => handleFormChange('active', e.target.checked)}
                    />
                  }
                  label={`활성 상태 (현재: ${Boolean(formData.active) ? '활성' : '비활성'})`}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={editingUser ? "새 비밀번호 (선택사항)" : "비밀번호"}
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleFormChange('password', e.target.value)}
                  error={!!formErrors.password}
                  helperText={formErrors.password}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="비밀번호 확인"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleFormChange('confirmPassword', e.target.value)}
                  error={!!formErrors.confirmPassword}
                  helperText={formErrors.confirmPassword}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>취소</Button>
          <Button
            onClick={handleSaveUser}
            variant="contained"
            disabled={submitLoading}
          >
            {submitLoading ? '저장 중...' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>사용자 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            정말로 <strong>{userToDelete?.fullName || userToDelete?.username || '이 사용자'}</strong>를 삭제하시겠습니까?
            이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>취소</Button>
          <Button onClick={handleDeleteUser} color="error" variant="contained">
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserManagement;