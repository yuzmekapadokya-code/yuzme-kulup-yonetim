# Secretary Mobile Analysis

## Web Role Inventory

- Student registration with parent account creation
- Student edit and delete with cross-collection cleanup
- Dynamic branch, schedule and trainer dependency flow
- Price lookup from `prices` using branch and schedule timing
- Installment plan generation with due date and lesson note per installment
- Discount validation and application from `discounts`
- Payment modal with cash, transfer and credit card evidence rules
- Automatic lesson group chat creation for admin, secretary, trainer and parent
- Direct chat and manual group chat creation by e-mail

## Collections Used

- `users`
- `students`
- `payments`
- `branches`
- `schedules`
- `trainers`
- `prices`
- `discounts`
- `chats`
- `attendance`
- `performances`
- `lesson_comments`
- `trainer_reviews`
- `student_workouts`

## Mobile Implementation Notes

- Home screen summarizes operational load, installment pressure and chat state.
- Registration screen mirrors the web registration form and supports edit mode.
- Students screen handles grouped listing, detail view, payment processing and cleanup delete.
- Chat operations screen adds direct-chat lookup and manual group chat creation that the shared chat tab does not cover.
- Existing shared Firebase backend and collection shapes are reused without changing the web project.