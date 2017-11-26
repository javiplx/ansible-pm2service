# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|

  config.vm.hostname = "pm2service"
  config.vm.box = ENV.fetch("BASEBOX", "centos6")

  config.vm.provision "shell", inline: <<-SHELL
    rpm -Uvh https://rpm.nodesource.com/pub_8.x/el/6/x86_64/nodesource-release-el6-1.noarch.rpm
    yum install -y ansible nodejs
    mkdir -p /vagrant /home/vagrant/.ansible/roles
    ln -sf /vagrant /home/vagrant/.ansible/roles/pm2service
    mkdir -p /usr/share/ansible/roles
    npm install --global pm2
  SHELL
end
