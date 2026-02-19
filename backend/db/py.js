import bcrypt

password = b"admin"
hashed = bcrypt.hashpw(password, bcrypt.gensalt())
print(hashed)
