const prisma = require('../../config/db');

async function list() {
  return prisma.employee.findMany({
    orderBy: { id: 'desc' },
    include: { attendances: true } // Example: include relations if needed
  });
}

async function get(id) {
  return prisma.employee.findUnique({
    where: { id: parseInt(id) }
  });
}

async function create(payload) {
  return prisma.employee.create({
    data: {
      empCode: payload.empCode,
      firstName: payload.firstName,
      middleName: payload.middleName,
      lastName: payload.lastName,
      fatherName: payload.fatherName,
      dob: payload.dob,
      gender: payload.gender,
      maritalStatus: payload.maritalStatus,
      spouseName: payload.spouseName,
      nic: payload.nic,
      birthPlace: payload.birthPlace,
      beneficiaryName: payload.beneficiaryName,
      beneficiaryRelation: payload.beneficiaryRelation,
      address: payload.address,
      city: payload.city,
      phone: payload.phone,
      email: payload.email,
      reference1: payload.reference1,
      reference2: payload.reference2,
      
      departmentText: payload.department,
      role: payload.designation,
      status: payload.status,
      appointmentDate: payload.appointmentDate,
      weeklyHoliday: payload.weeklyHoliday,
      workingDays: payload.workingDays,
      disbursement: payload.disbursement,
      salaryMonthly: payload.basicSalary ? parseFloat(payload.basicSalary) : 0,
      allowances: payload.allowances || [],

      dutyType: payload.dutyType,
      dutyRoster: payload.dutyRoster || [],

      photo: payload.photo,
      emergencyContact: payload.emergencyContact,
      emergencyPhone: payload.emergencyPhone,
      emergencyRelation: payload.emergencyRelation,
      notes: payload.notes
    }
  });
}

async function update(id, payload) {
  const {
    firstName,
    lastName,
    email,
    phone,
    salaryMonthly,
    departmentId,
    role,
    status,
    allowances,
  } = payload;

  return prisma.employee.update({
    where: { id: parseInt(id) },
    data: {
      firstName,
      lastName,
      email,
      phone,
      salaryMonthly: salaryMonthly ? parseFloat(salaryMonthly) : undefined,
      departmentId: departmentId ? parseInt(departmentId) : undefined,
      role,
      status,
      allowances,
    }
  });
}

async function remove(id) {
  try {
    await prisma.employee.delete({
      where: { id: parseInt(id) }
    });
    return true;
  } catch (error) {
    if (error.code === 'P2025') return false; // Record not found
    throw error;
  }
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
};