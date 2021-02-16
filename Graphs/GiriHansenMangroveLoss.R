library(ggplot2)
library(dplyr)



hansen <-Hansen_x_Giri_2000_2019_Forest_LOSS_ONLY

names(hansen)[1] <- "Year"
names(hansen)[2] <- "Forest_loss_(m2)" #change to forest to make it work
names(hansen)[3]<-  "mangrove"

hansen_clean <- na.omit(hansen)


(scatter <- ggplot(hansen_clean, aes(x = Year, y = mangrove)) +  
    ylab("Mangrove loss (ha)\n") +                                                   # Changing the text of the y axis label
    xlab("\nYear")+ 
    theme_bw()+
    theme(axis.text.x = element_text(size = 12, angle = 45, vjust = 1, hjust = 1),     # making the years at a bit of an angle
          axis.text.y = element_text(size = 12),
          axis.title = element_text(size = 14, face = "plain"),                        
          plot.margin = unit(c(1,1,1,1), units = , "cm"))+
    geom_point(color="#A25FD4")+
    scale_x_continuous(breaks=c(2001,2003,2005,2007,2009,2011,2013,2015,2017,2019),
                       labels=c("2001","2003","2005","2007","2009","2011","2013","2015","2017","2019"),
                       limit=c(2001,2019))
)


