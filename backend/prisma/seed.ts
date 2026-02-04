import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@taskapp.com' },
    update: {},
    create: {
      email: 'admin@taskapp.com',
      password: adminPassword,
      role: Role.ADMIN,
    },
  });
  console.log('Created admin user:', admin.email);

  // Create regular user
  const userPassword = await bcrypt.hash('User@123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@taskapp.com' },
    update: {},
    create: {
      email: 'user@taskapp.com',
      password: userPassword,
      role: Role.USER,
    },
  });
  console.log('Created regular user:', user.email);

  // Create some sample tasks
  await prisma.task.createMany({
    data: [
      {
        title: 'Complete project documentation',
        description: 'Write comprehensive README and API docs',
        userId: user.id,
        status: 'PENDING',
      },
      {
        title: 'Setup CI/CD pipeline',
        description: 'Configure GitHub Actions for automated testing',
        userId: user.id,
        status: 'IN_PROGRESS',
      },
      {
        title: 'Review pull requests',
        description: 'Review and merge pending PRs',
        userId: admin.id,
        status: 'COMPLETED',
      },
    ],
  });
  console.log('Created sample tasks');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
