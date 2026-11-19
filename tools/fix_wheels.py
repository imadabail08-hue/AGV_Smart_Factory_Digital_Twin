import trimesh
import numpy as np

stl_file = r'C:\Users\Windows 10\Documents\PlatformIO\Projects\Comprendre l’algorithme A\agv_smart_factory\models\agv_rescue_swarm.stl'
mesh = trimesh.load(stl_file)

v = mesh.vertices
f = mesh.faces

# Check the direction of the wheels:
# The 4 wheels are located at:
# LF: X < -100, Y > 40
# LR: X < -100, Y < -40
# RF: X > 100, Y > 40
# RR: X > 100, Y < -40

# In this CAD model:
# X is the LATERAL axis (left/right, distance between left and right wheels is 284mm)
# Y is the LONGITUDINAL axis (front/rear, distance between front and rear wheels is 282mm)
# Z is the VERTICAL axis (height, 0 to 278mm)

# The wheels are circular in the Y-Z plane!
# So the wheels roll forward/backward along the Y axis!
# And the wheel axles are parallel to the X axis!

print('CAD analysis complete.')
