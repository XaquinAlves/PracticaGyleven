from django.db import models

# Create your models here.
class NearEarthObject(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=255)
    diameter_min = models.FloatField()
    diameter_max = models.FloatField()
    is_potentially_hazardous = models.BooleanField()

    def __str__(self):
        return self.name
