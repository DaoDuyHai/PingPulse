import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { type Request, type Response } from 'express';
import { createHttpError } from '../utils/httpError.js';

export const register = async (req: Request, res: Response) => {
  const { username, password, email } = req.body;

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    typeof email !== 'string' ||
    !username.trim() ||
    !password ||
    !email.trim()
  ) {
    throw createHttpError(400, 'Vui long dien day du thong tin hop le');
  }

  const existingUser = await prisma.users.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
    select: { id: true },
  });
  if (existingUser) {
    throw createHttpError(400, 'Username hoac Email nay da ton tai');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = await prisma.users.create({
    data: {
      username,
      email,
      password_hash: passwordHash,
    },
    select: {
      id: true,
      username: true,
      email: true,
      created_at: true,
    },
  });

  return res.status(201).json({
    message: 'Dang ky tai khoan thanh cong',
    data: newUser,
  });
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !username.trim() ||
    !password
  ) {
    throw createHttpError(400, 'Vui long dien day du thong tin');
  }

  const existingUser = await prisma.users.findUnique({
    where: {
      username,
    },
  });

  if (!existingUser) {
    throw createHttpError(400, 'Tai khoan hoac mat khau khong chinh xac');
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    existingUser.password_hash
  );

  if (!isPasswordValid) {
    throw createHttpError(400, 'Tai khoan hoac mat khau khong chinh xac');
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET chua duoc cau hinh trong .env');
  }

  const payload = {
    username: existingUser.username,
    id: existingUser.id,
  };

  const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });

  return res.status(200).json({ message: 'Da dang nhap thanh cong', token });
};

export const info = async (req: Request, res: Response) => {
  const id = req.user?.id;

  if (!id) {
    throw createHttpError(401, 'Ban phai dang nhap de xem thong tin nay');
  }

  const user = await prisma.users.findUnique({
    where: {
      id,
    },
    select: {
      email: true,
      username: true,
      created_at: true,
    },
  });

  if (!user) {
    throw createHttpError(404, 'Khong tim thay nguoi dung');
  }

  return res
    .status(200)
    .json({ message: 'Da lay thong tin thanh cong', data: user });
};
